import os
import time
import json
import base64
import pandas as pd
from groq import Groq

# --- 1. CONFIGURATION ---
API_KEY = os.getenv("GROK_API")
IMAGE_DIR = "./raw_crash_images"
OUTPUT_CSV = "labels.csv"
MAX_REQUESTS_PER_SESSION = 950 

client = Groq(api_key=API_KEY)

# --- 2. THE SCHEMA ---


json_format_str = "{\n" + ",\n".join([f'  "{part}": <int>' for part in EXPECTED_PARTS]) + "\n}"
EXPECTED_PARTS = [
    "front_bumper", "rear_bumper", "hood", "trunk", "roof",
    "windshield", "rear_window", "left_front_fender", "right_front_fender",
    "left_rear_quarter_panel", "right_rear_quarter_panel", "left_front_door",
    "right_front_door", "left_rear_door", "right_rear_door",
    "headlights", "taillights", "grille"
]
SYSTEM_PROMPT = f"""
You are an expert auto insurance adjuster. Analyze this image of a vehicle.
Rate the damage severity for all standard exterior parts on a scale of 0 to 3:
0 = None (Undamaged) OR Not Visible in this specific photo
1 = Low (Scratches, minor dents)
2 = Medium (Deep dents, cracked glass, misaligned panels)
3 = Severe (Shattered, structural frame damage, completely destroyed)

CRITICAL RULE: If a part cannot be clearly seen, you MUST score it as 0. Do not guess.

Output ONLY a valid JSON object. Do not include markdown formatting or any other text:
{json_format_str}
"""

def encode_image(image_path):
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

def initialize_csv():
    headers = ['filename'] + EXPECTED_PARTS
    if not os.path.exists(OUTPUT_CSV):
        df = pd.DataFrame(columns=headers)
        df.to_csv(OUTPUT_CSV, index=False)
        return []
    else:
        return pd.read_csv(OUTPUT_CSV)['filename'].tolist()

def annotate_images():
    processed_files = initialize_csv()
    all_files = [f for f in os.listdir(IMAGE_DIR) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
    
    print(f"Found {len(all_files)} images. {len(processed_files)} already processed.")
    
    session_requests = 0 
    
    for i, filename in enumerate(all_files):
        if filename in processed_files:
            continue 
            
        # The Kill Switch to protect your Groq limit
        if session_requests >= MAX_REQUESTS_PER_SESSION:
            print(f"\n[🛑 STOPPING] Reached the safe limit of {MAX_REQUESTS_PER_SESSION} requests.")
            print("The script has paused gracefully to protect your daily API quota.")
            print("Just run the exact same script tomorrow to finish the last batch!")
            break
            
        file_path = os.path.join(IMAGE_DIR, filename)
        
        try:
            print(f"[{i+1}/{len(all_files)}] Groq Llama 4 analyzing {filename}...")
            base64_image = encode_image(file_path)
            
            chat_completion = client.chat.completions.create(
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": SYSTEM_PROMPT},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}",
                                },
                            },
                        ],
                    }
                ],
                model="meta-llama/llama-4-scout-17b-16e-instruct", 
                response_format={"type": "json_object"}, 
            )
            
            damage_data = json.loads(chat_completion.choices[0].message.content)
            
            row_data = {'filename': filename}
            for part in EXPECTED_PARTS:
                row_data[part] = damage_data.get(part, 0) 
            
            new_row = pd.DataFrame([row_data])
            new_row.to_csv(OUTPUT_CSV, mode='a', header=False, index=False)
            
            session_requests += 1 
            time.sleep(2.5) 
            
        except Exception as e:
            print(f"Error processing {filename}: {e}")
            time.sleep(10)

if __name__ == "__main__":
    print("Starting High-Speed Groq VLM annotation pipeline...")
    annotate_images()
    print(f"Annotation complete! Data saved to {OUTPUT_CSV}")