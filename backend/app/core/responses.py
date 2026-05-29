from typing import Any


def success(data: Any = None, message: str = "ok") -> dict[str, Any]:
    return {"success": True, "message": message, "data": data}


def error(message: str, code: str = "bad_request") -> dict[str, Any]:
    return {"success": False, "message": message, "code": code}
