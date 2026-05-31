
import requests
import re
import sys

def test_m3u8_rewrite(m3u8_url):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.diziyou.one/'
    }
    
    print(f"--- Fetching Master Playlist: {m3u8_url} ---")
    try:
        r = requests.get(m3u8_url, headers=headers, timeout=10)
        content = r.text
        print("Content Preview (Master):")
        print("\n".join(content.splitlines()[:10]))
        
        # Find media playlist
        media_match = re.search(r'([^\s]+\.m3u8)', content)
        if media_match:
            media_playlist = media_match.group(1)
            # Make it absolute
            if not media_playlist.startswith('http'):
                base_url = m3u8_url.rsplit('/', 1)[0]
                media_playlist = f"{base_url}/{media_playlist}"
            
            print(f"\n--- Fetching Media Playlist: {media_playlist} ---")
            r2 = requests.get(media_playlist, headers=headers, timeout=10)
            media_content = r2.text
            print("Content Preview (Media):")
            print("\n".join(media_content.splitlines()[:15]))
            
            # Look for segments
            segments = re.findall(r'([^\s]+\.ts)', media_content)
            if segments:
                print(f"\n--- Testing Segment Fetch: {segments[0]} ---")
                # Try fetching segment without referer to see if it fails (simulating browser)
                r3 = requests.get(segments[0], headers={'User-Agent': headers['User-Agent']}, timeout=10)
                print(f"Segment Fetch Without Referer Status: {r3.status_code}")
                
                # Try with referer (simulating proxy)
                r4 = requests.get(segments[0], headers=headers, timeout=10)
                print(f"Segment Fetch With Referer Status: {r4.status_code}")
                
                if r4.status_code == 200:
                    print("\n✅ PROXY REWRITE SOLUTION WILL WORK!")
                    print("We need to rewrite the .m3u8 content to pipe these .ts segments through our proxy.")
                else:
                    print("\n❌ EVEN PROXY CANNOT FETCH SEGMENTS (Possible IP Block or Token)")
            else:
                print("\n❌ No .ts segments found in media playlist.")
        else:
            print("\n❌ No media playlist found in master playlist.")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_url = "https://storage.diziyou.one/episodes/13451/play.m3u8"
    test_m3u8_rewrite(test_url)
