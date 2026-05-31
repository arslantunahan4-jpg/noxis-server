
import requests
import re
import json
import time

def parse_title(title):
    # Matches "Title 1.Sezon 1.Bölüm" or "Title 1.Bölüm"
    season_match = re.search(r'(\d+)\.Sezon', title)
    episode_match = re.search(r'(\d+)\.Bölüm', title)
    
    season = season_match.group(1) if season_match else "1"
    episode = episode_match.group(1) if episode_match else "1"
    
    # Clean title
    clean_title = re.sub(r'\s*\d+\.Sezon.*', '', title)
    clean_title = re.sub(r'\s*\d+\.Bölüm.*', '', clean_title)
    clean_title = clean_title.replace('izle', '').strip()
    
    return clean_title, season, episode

def test_dizimom():
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.dizimom.fit/'
    }

    print("Fetching 20 recent posts from Dizimom WP-API...")
    try:
        # WP-API sorgusuna headers eklendi
        r = requests.get("https://www.dizimom.fit/wp-json/wp/v2/posts?per_page=20", headers=headers, timeout=15)
        posts = r.json()
    except Exception as e:
        print(f"Error fetching posts: {e}")
        return

    results = []
    for post in posts:
        raw_title = post['title']['rendered']
        title, season, episode = parse_title(raw_title)
        
        print(f"Testing: {title} S{season}E{episode}...", end=" ", flush=True)
        
        try:
            # Local API sorgusu
            api_url = f"http://localhost:3000/api/dizimom"
            params = {'title': title, 'season': season, 'episode': episode}
            resp = requests.get(api_url, params=params, headers=headers, timeout=40)
            data = resp.json()
            
            if data.get('success'):
                url = data.get('url', '')
                domain = url.split('/')[2] if '/' in url else 'unknown'
                print(f"✅ SUCCESS ({domain})")
                results.append({'title': title, 'status': 'SUCCESS', 'domain': domain})
            else:
                error = data.get('error', 'Unknown error')
                print(f"❌ FAILED ({error})")
                results.append({'title': title, 'status': 'FAILED', 'error': error})
        except Exception as e:
            print(f"⚠️ ERROR ({e})")
            results.append({'title': title, 'status': 'ERROR', 'error': str(e)})
        
        time.sleep(1) # Biraz daha yavaş gidelim block yemeyelim

    print("\n" + "="*40)
    print("TEST SUMMARY")
    print("="*40)
    success = len([r for r in results if r['status'] == 'SUCCESS'])
    print(f"Total Tested: {len(results)}")
    print(f"Success: {success}")
    print(f"Failed: {len(results) - success}")
    if len(results) > 0:
        print("\nSuccess Rate: {:.1f}%".format((success/len(results))*100))

if __name__ == "__main__":
    test_dizimom()
