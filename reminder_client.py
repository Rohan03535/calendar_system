import urllib.request
import json
import sys

def main():
    print("====================================")
    print(" DBS LOCAL REMINDER CLIENT V1.0")
    print("====================================")
    
    try:
        user_id = input("Enter your Calendar User ID (e.g. 1 for Alice, 2 for Bob): ").strip()
        if not user_id.isdigit():
            print("Please enter a valid numeric ID.")
            sys.exit(1)
            
        url = f"http://localhost:3000/api/reminders/{user_id}"
        print("Fetching your next 10 upcoming reminders...\n")
        
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
            
            if len(data) == 0:
                print("🌟 You have no upcoming programmed events. Relax!")
                sys.exit(0)
            
            for idx, event in enumerate(data, 1):
                print(f"[{idx}] {event.get('title', 'Unknown Title')}")
                
                # Format Dates simply
                start_iso = event.get('instance_start', 'N/A')
                start_fmt = start_iso.replace('T', ' ').split('.')[0] if start_iso != 'N/A' else 'N/A'
                
                print(f"    ⏰ Start Time:  {start_fmt}")
                print(f"    📍 Location:    {event.get('location', 'N/A')}")
                print(f"    📝 Description: {event.get('description', 'N/A')}")
                print(f"    👤 Organized:   {event.get('creator_name', 'You')}")
                print("-" * 40)
                
    except urllib.error.URLError:
        print("\n❌ CRITICAL ERROR: Could not connect to backend.")
        print("Make sure your Node.js calendar_server is actually running on localhost:3000!")
    except Exception as e:
        print(f"\n❌ Error: {e}")

if __name__ == "__main__":
    main()
