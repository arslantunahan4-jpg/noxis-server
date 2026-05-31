import { useState, useEffect, useRef } from 'react';
import { getWatchHistory, getLastWatched } from '../utils/watchHistory';
import RecWorker from '../workers/recommendation.worker?worker';
import { getApiBaseUrl } from '../utils/apiBaseUrl';

export const useSmartRecommendations = () => {
    const [recommendations, setRecommendations] = useState({
        topPicks: [], 
        becauseYouWatched: [], 
        genreBased: [], 
        loading: true
    });
    
    // Worker instance'ını ref ile tutuyoruz ki her renderda yeniden yaratılmasın
    const workerRef = useRef(null);

    // Son izlenen öğeye göre dinamik olarak güncellenmesini tetikle
    const lastWatched = getLastWatched();
    const lastWatchedKey = lastWatched 
        ? `${lastWatched.id || lastWatched.imdbId}_${lastWatched.updatedAt}_${lastWatched.completed}` 
        : 'empty';

    useEffect(() => {
        // Worker Başlatma
        if (!workerRef.current) {
            workerRef.current = new RecWorker();
        }

        const worker = workerRef.current;

        // Worker'dan gelen mesajı dinle
        worker.onmessage = (e) => {
            const { type, result, error } = e.data;
            if (type === 'SUCCESS') {
                setRecommendations({ ...result, loading: false });
            } else {
                console.error('[RecWorker Error]', error);
                setRecommendations(prev => ({ ...prev, loading: false }));
            }
        };

        // Worker'a iş gönder
        const history = getWatchHistory();
        const apiUrl = getApiBaseUrl();
        
        worker.postMessage({ history, apiUrl });

        // Cleanup: Component unmount olduğunda worker'ı sonlandır
        return () => {
            worker.terminate();
            workerRef.current = null;
        };
    }, [lastWatchedKey]);

    return recommendations;
};
