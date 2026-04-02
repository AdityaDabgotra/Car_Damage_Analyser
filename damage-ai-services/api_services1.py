from fastapi import FastAPI
from pydantic import BaseModel
from typing import Dict
from main import main_

app = FastAPI()


class InputData(BaseModel):
    brand: str
    model: str
    year: int
    cvResponse: Dict[str, str]
    urgency: str
    totalEstimatedMin: int
    totalEstimatedMax: int
    name: str
    email: str
    phone: int


@app.post("/process")
def process_data(data: InputData):
    data = data.dict()

    processed_data = {}

    processed_data["car"] = {
        "brand": data["brand"],
        "model": data["model"],
        "year": str(data["year"])
    }

    processed_data["damaged_parts"] = data["cvResponse"]
    processed_data["severity"] = data["urgency"]
    processed_data["min_cost"] = data["totalEstimatedMin"]
    processed_data["max_cost"] = data["totalEstimatedMax"]

    processed_data["user_info"] = {
        "name": data["name"],
        "email": data["email"],
        "phone": str(data["phone"])
    }

    response = main_(processed_data)

    return {"done": response}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app,port=8500)