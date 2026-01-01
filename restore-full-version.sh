#!/bin/bash

# ============================================
# TAM VERSİYONA GERİ DÖN
# ============================================
# Bu script Railway lightweight versiyonundan
# tam WebTorrent+FFmpeg versiyonuna geri döner.
#
# Kullanım: ./restore-full-version.sh
# ============================================

echo "📦 Tam versiyon geri yükleniyor..."

# Backup kontrolü
if [ ! -d "_full-version-backup" ]; then
    echo "❌ Hata: _full-version-backup klasörü bulunamadı!"
    exit 1
fi

# Dosyaları geri yükle
cp _full-version-backup/vite.config.js .
cp _full-version-backup/package.json .
cp -r _full-version-backup/server .

echo "✅ Tam versiyon geri yüklendi!"
echo ""
echo "Şimdi şunu çalıştırın:"
echo "  npm install"
echo "  npm run dev"
