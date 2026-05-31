async function checkAudio() {
  const trAudio = 'https://vidmody.com/mm/tt22022452/main2/index-a1.gif';
  const enAudio = 'https://vidmody.com/mm/tt22022452/main2/index-a2.gif';
  console.log('[+] Probing TR audio:', trAudio);
  console.log('[+] Probing EN audio:', enAudio);
  try {
    const resTr = await fetch(trAudio, { method: 'HEAD', headers: { 'Referer': 'https://vidmody.com/' } });
    const resEn = await fetch(enAudio, { method: 'HEAD', headers: { 'Referer': 'https://vidmody.com/' } });
    console.log('[+] TR Audio status:', resTr.status);
    console.log('[+] EN Audio status:', resEn.status);
  } catch (e) {
    console.error('[-] Error probing:', e);
  }
}

checkAudio();
