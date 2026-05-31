import { useState, useEffect, useCallback, useRef } from 'react';

export const useTVNavigation = (rowCount, getColCountForRow) => {
    // activeRow: Hangi kategorideyiz? (0: İlk kategori)
    // activeCols: Her satırın hangi filmde olduğu (Dizi şeklinde tutuyoruz)
    // Örn: [0, 4, 1] -> 1. satır 0. film, 2. satır 4. film, 3. satır 1. filmde kalmış
    const [activeRow, setActiveRow] = useState(0);
    const [activeCols, setActiveCols] = useState({});

    // Throttling için (Çok hızlı basmayı engellemek - performans için)
    const lastInputTime = useRef(0);
    const THROTTLE_MS = 200; // 200ms gecikme (Animasyonun bitmesini beklemek için)

    const handleKeyDown = useCallback((e) => {
        const now = Date.now();
        if (now - lastInputTime.current < THROTTLE_MS) return; // Engelle

        // Varsayılan tarayıcı kaydırmasını engelle
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
            e.preventDefault();
        }

        const currentCol = activeCols[activeRow] || 0;
        const colCount = getColCountForRow(activeRow);

        switch (e.key) {
            case 'ArrowRight':
                // Eğer sağda film varsa ilerle
                if (currentCol < colCount - 1) {
                    setActiveCols(prev => ({ ...prev, [activeRow]: currentCol + 1 }));
                    lastInputTime.current = now;
                }
                break;

            case 'ArrowLeft':
                // Eğer solda film varsa geri git
                if (currentCol > 0) {
                    setActiveCols(prev => ({ ...prev, [activeRow]: currentCol - 1 }));
                    lastInputTime.current = now;
                }
                break;

            case 'ArrowDown':
                // Aşağıda kategori varsa in
                if (activeRow < rowCount - 1) {
                    setActiveRow(prev => prev + 1);
                    lastInputTime.current = now;
                }
                break;

            case 'ArrowUp':
                // Yukarıda kategori varsa çık
                if (activeRow > 0) {
                    setActiveRow(prev => prev - 1);
                    lastInputTime.current = now;
                }
                break;

            case 'Enter':
                // Seçim işlemi (Dışarıdan handle edilecek)
                break;

            case 'Backspace':
            case 'Escape':
                // Geri/Çıkış (Dışarıdan handle edilecek)
                break;
        }
    }, [activeRow, activeCols, rowCount, getColCountForRow]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    return {
        activeRow,
        activeCol: activeCols[activeRow] || 0,
        setActiveRow,
        // Belirli bir satırın aktif kolonunu getir (hafızada tutulan)
        getColIndex: (rowIndex) => activeCols[rowIndex] || 0
    };
};
