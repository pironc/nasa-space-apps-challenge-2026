"""Throwaway check: slowapi per-IP limit + global daily budget on a FastAPI LLM endpoint returns 429, not a bill."""
from fastapi import FastAPI, HTTPException, Request
from fastapi.testclient import TestClient
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

def client_ip(request: Request) -> str:
    # Behind a proxy request.client.host is the proxy. Take the LAST X-Forwarded-For hop (appended by the
    # platform, so the caller cannot spoof it); fall back to the socket address locally.
    xff = request.headers.get("x-forwarded-for")
    return xff.split(",")[-1].strip() if xff else get_remote_address(request)


limiter = Limiter(key_func=client_ip)
app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
budget = {"calls_left": 4}  # ponytail: in-memory, per instance; fine with Cloud Run max-instances=1..2


@app.post("/api/narrative")
@limiter.limit("3/minute;30/day")
async def narrative(request: Request):
    if budget["calls_left"] <= 0:
        raise HTTPException(503, "LLM budget for today is spent; showing template text")
    budget["calls_left"] -= 1
    return {"source": "llm"}


if __name__ == "__main__":
    c = TestClient(app)
    codes = [c.post("/api/narrative").status_code for _ in range(5)]
    assert codes == [200, 200, 200, 429, 429], codes
    # another client IP is limited separately, then the global budget trips
    other = [c.post("/api/narrative", headers={"x-forwarded-for": "198.51.100.1, 203.0.113.9"}).status_code for _ in range(2)]
    assert other == [200, 503], other  # separate bucket per IP; second call hits the global daily budget
    print("same-ip codes", codes, "| after:", other, "| budget left", budget["calls_left"])
    print("ok")
