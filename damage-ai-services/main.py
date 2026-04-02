from typing import TypedDict, List, Dict, Optional
from langgraph.graph import StateGraph, END , START
import smtplib
from email.mime.text import MIMEText
from groq import Groq
import json
import os
from dotenv import load_dotenv
load_dotenv()

class GraphState(TypedDict):

    car: Dict[str, str] 

    damaged_parts: Dict[str, str]  

    severity: Optional[str]

    min_cost:int

    max_cost:int

    user_info: Optional[Dict[str, str]]


client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def send_email(to_email, subject, body):
    sender_email = "claim.vision.99@gmail.com"
    sender_password = os.getenv("EMAIL_PASSWORD")  # use app password

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = sender_email
    msg["To"] = to_email

    with smtplib.SMTP("smtp.gmail.com", 587) as server:
        server.starttls()
        server.login(sender_email, sender_password)
        server.send_message(msg)




def notify_node(state: GraphState) -> GraphState:
    user = state.get("user_info", {})
    car = state.get("car", {})
    parts=state.get("damaged_parts")
    name = user.get("name")
    email = user.get("email")
    phone = user.get("phone")

    total_min, total_max = state.get("min_cost") , state.get("max_cost")

    # -------------------------
    # Separate parts
    # -------------------------
    repair_parts = []
    replacement_parts = []

    for part, info in parts.items():
        if info == "repair":
            repair_parts.append(part)
        elif info == "replacement":
            replacement_parts.append(part)

    # =========================
    # 🧠 USER EMAIL (LLM)
    # =========================
    user_prompt = f"""
You are an automobile assistant.

Generate a simple and clear email for a user.

Details:
User-Name:{user.get('name')}
Car: {car.get('brand')} {car.get('model')}
Repair Parts: {repair_parts}
Replacement Parts: {replacement_parts}
Total Cost: ₹{total_min} - ₹{total_max}

Instructions:
- Keep it simple and friendly
- Explain difference between repair and replacement
- Do not use technical jargon
- Keep it short
- also don't mention Your name try to mention users name instead
"""

    user_response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": user_prompt}],
        temperature=0.5
    )

    user_body = user_response.choices[0].message.content

    user_subject = "Your Car Repair Estimate 🚗"

    send_email(email, user_subject, user_body)

    # =========================
    # 🔧 SERVICE EMAIL (LLM)
    # =========================
    service_prompt = f"""
Generate a structured repair request email for a service center.

Include:
- Customer Name: {name}
- Phone: {phone}
- Email: {email}
- Car: {car.get('brand')} {car.get('model')}

List clearly:
- Parts to be repaired
- Parts to be replaced

Repair Parts: {repair_parts}
Replacement Parts: {replacement_parts}


Instructions:
- Do NOT explain anything
- Keep it structured and professional
- No extra text
"""

    service_response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": service_prompt}],
        temperature=0
    )

    service_body = service_response.choices[0].message.content

    service_subject = "New Repair Request 🔧"

    service_email = "2023nitsgr277@nitsri.ac.in"

    send_email(service_email, service_subject, service_body)

    return state


def builder_func():
    builder = StateGraph(GraphState)
    builder.add_node("notify", notify_node)
    builder.add_edge(START, "notify")
    builder.add_edge("notify", END)
    graph = builder.compile()
    return graph

def main_(state: StateGraph):
    graph=builder_func()
    graph.invoke(state)
    return "yes"
