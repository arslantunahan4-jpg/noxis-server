import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const IntroAnimation = ({ onComplete }) => {
  const [introComplete, setIntroComplete] = useState(false);

  const handleSkip = () => {
    setIntroComplete(true);
    onComplete && onComplete();
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setIntroComplete(true);
      onComplete && onComplete();
    }, 3500);
    
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {!introComplete && (
        <motion.div
          className="intro-container"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          style={{
            position: 'fixed',
            inset: 0,
            background: '#000',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden'
          }}
          onClick={handleSkip}
        >
          <motion.div
            className="glow-bg"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: [0, 0.6, 0.4], scale: [0.8, 1.2, 1] }}
            transition={{ duration: 2, ease: "easeOut" }}
            style={{
              position: 'absolute',
              width: '500px',
              height: '500px',
              background: 'radial-gradient(circle, rgba(200, 162, 200, 0.15) 0%, rgba(138, 43, 226, 0.08) 40%, transparent 70%)',
              borderRadius: '50%',
              filter: 'blur(60px)'
            }}
          />

          <motion.div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              zIndex: 10
            }}
          >
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '24px'
              }}
            >
              <motion.svg 
                viewBox="0 0 50 53" 
                style={{ width: '48px', height: 'auto' }}
                initial={{ filter: 'drop-shadow(0 0 0px rgba(200, 162, 200, 0))' }}
                animate={{ filter: 'drop-shadow(0 0 20px rgba(200, 162, 200, 0.6))' }}
                transition={{ duration: 0.8, delay: 0.3 }}
              >
                <defs>
                  <linearGradient id="introGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{ stopColor: '#C8A2C8' }} />
                    <stop offset="50%" style={{ stopColor: '#9370DB' }} />
                    <stop offset="100%" style={{ stopColor: '#8A2BE2' }} />
                  </linearGradient>
                  <linearGradient id="introRibbon" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{ stopColor: '#E6E6FA' }} />
                    <stop offset="100%" style={{ stopColor: '#C8A2C8' }} />
                  </linearGradient>
                </defs>
                <path 
                  d="M5 45 L5 8 Q5 5 8 5 L12 5 Q15 5 15 8 L15 32 L32 8 Q34 5 38 5 L42 5 Q45 5 45 8 L45 45 Q45 48 42 48 L38 48 Q35 48 35 45 L35 20 L18 44 Q16 48 12 48 L8 48 Q5 48 5 45 Z" 
                  fill="url(#introGrad)"
                />
                <path d="M38 5 Q50 15 45 30 Q42 40 35 45" stroke="url(#introRibbon)" strokeWidth="3" fill="none" strokeLinecap="round"/>
                <path d="M28 20 L40 28 L28 36 Z" fill="url(#introRibbon)" opacity="0.8"/>
              </motion.svg>
              
              <motion.div
                style={{
                  display: 'flex',
                  gap: '2px'
                }}
              >
                {['N', 'O', 'X', 'I', 'S'].map((letter, i) => (
                  <motion.span
                    key={letter}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ 
                      duration: 0.4, 
                      delay: 0.1 + i * 0.08,
                      ease: [0.16, 1, 0.3, 1]
                    }}
                    style={{
                      fontSize: '42px',
                      fontWeight: '200',
                      letterSpacing: '0.15em',
                      background: letter === 'X' 
                        ? 'linear-gradient(135deg, #E6E6FA 0%, #C8A2C8 50%, #9370DB 100%)'
                        : 'linear-gradient(180deg, #fff 0%, rgba(200, 162, 200, 0.85) 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      fontFamily: 'system-ui, -apple-system, sans-serif'
                    }}
                  >
                    {letter}
                  </motion.span>
                ))}
              </motion.div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 0.3, width: '200px' }}
              transition={{ duration: 0.6, delay: 0.6 }}
              style={{
                height: '1px',
                background: 'linear-gradient(90deg, transparent, rgba(200, 162, 200, 0.8), transparent)',
                marginBottom: '16px'
              }}
            />
            
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              transition={{ duration: 0.5, delay: 0.8 }}
              style={{
                fontSize: '11px',
                fontWeight: '400',
                letterSpacing: '0.25em',
                color: 'rgba(200, 162, 200, 0.8)',
                textTransform: 'uppercase',
                fontFamily: 'system-ui, -apple-system, sans-serif'
              }}
            >
              New Ocular Experience Is Starting
            </motion.p>
          </motion.div>

          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ 
                opacity: [0, 0.4, 0],
                scale: [0, 1, 1.5],
                x: Math.cos(i * 60 * Math.PI / 180) * 150,
                y: Math.sin(i * 60 * Math.PI / 180) * 150
              }}
              transition={{ 
                duration: 2,
                delay: 0.5 + i * 0.1,
                ease: "easeOut"
              }}
              style={{
                position: 'absolute',
                width: '4px',
                height: '4px',
                borderRadius: '50%',
                background: 'rgba(200, 162, 200, 0.6)',
                boxShadow: '0 0 10px rgba(200, 162, 200, 0.8)'
              }}
            />
          ))}

          <motion.button
            className="intro-skip-btn"
            onClick={handleSkip}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            whileHover={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.3 }}
            style={{
              position: 'absolute',
              bottom: '40px',
              right: '40px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'rgba(255,255,255,0.6)',
              padding: '8px 20px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '400',
              letterSpacing: '0.1em',
              cursor: 'pointer',
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}
          >
            ATLA
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default IntroAnimation;
