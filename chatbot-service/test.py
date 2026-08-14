import os
from dotenv import load_dotenv
from google import genai

# Load environment variables from the .env file in the current directory
load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    print("❌ GEMINI_API_KEY not found in .env file.")
    print("Please make sure your .env file contains: GEMINI_API_KEY=your_actual_key")
else:
    client = genai.Client(api_key=api_key)

    print("✅ Connected! Here are the models available to your API key right now:\n")
    try:
        for m in client.models.list():
            if "generateContent" in m.supported_actions:
                print(f"- {m.name} (Display: {m.display_name})")
    except Exception as e:
        print(f"Error listing models: {e}")