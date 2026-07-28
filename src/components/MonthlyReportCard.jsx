import React from 'react';
import { motion } from 'framer-motion';
import { imageUrl } from '../tv/utils/media';

export const MonthlyReportCard = ({ report }) => {
    if (!report || report.totalHours <= 0) return null;

    // Extract unique posters for this month
    const posters = (report.items || [])
        .map(i => imageUrl(i.poster_path || i.backdrop_path, 'w185'))
        .filter(Boolean)
        .filter((value, index, self) => self.indexOf(value) === index)
        .slice(0, 4);

    return (
        <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="noxis-monthly-report-card"
        >
            <div className="noxis-monthly-header">
                <div>
                    <span className="noxis-monthly-badge">{report.badge?.title}</span>
                    <h3 className="noxis-monthly-title">{report.monthName} Raporu</h3>
                </div>
                <div className="noxis-monthly-hours">
                    <span>{report.totalHours}</span> <small>SAAT</small>
                </div>
            </div>

            <div className="noxis-monthly-stats-grid">
                <div className="noxis-monthly-stat-item">
                    <i className="fas fa-film" />
                    <div>
                        <strong>{report.moviesCount}</strong>
                        <small>Film</small>
                    </div>
                </div>
                <div className="noxis-monthly-stat-item">
                    <i className="fas fa-tv" />
                    <div>
                        <strong>{report.episodesCount}</strong>
                        <small>Dizi Bölümü</small>
                    </div>
                </div>
                <div className="noxis-monthly-stat-item">
                    <i className="fas fa-fire" />
                    <div>
                        <strong>{report.topGenreName}</strong>
                        <small>Favori Tür</small>
                    </div>
                </div>
            </div>

            {posters.length > 0 && (
                <div className="noxis-monthly-posters-strip">
                    <div className="noxis-monthly-posters-grid">
                        {posters.map((url, index) => (
                            <img key={index} src={url} alt="İzlendi" className="noxis-monthly-mini-poster" />
                        ))}
                    </div>
                </div>
            )}
        </motion.div>
    );
};
