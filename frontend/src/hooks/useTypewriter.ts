import { useState, useEffect, useRef, useCallback } from 'react';

// 為老舊瀏覽器提供 performance.now 的 polyfill
if (typeof performance === 'undefined' || !performance.now) {
  (window as any).performance = { now: () => Date.now() };
}

export const useTypewriter = (text: string, speed: number = 15) => {
    const [displayedText, setDisplayedText] = useState('');
    const textRef = useRef(text);
    const indexRef = useRef(0);
    const animationRef = useRef<number>(0);
    const lastUpdateRef = useRef(0);

    useEffect(() => {
        textRef.current = text;
        // 如果文本變化，重置索引
        if (text.length < indexRef.current) {
            indexRef.current = 0;
        }
    }, [text]);

    const updateText = useCallback(() => {
        const now = performance.now();
        if (now - lastUpdateRef.current >= speed && indexRef.current < textRef.current.length) {
            setDisplayedText(textRef.current.substring(0, indexRef.current + 1));
            indexRef.current++;
            lastUpdateRef.current = now;
        }

        if (indexRef.current < textRef.current.length) {
            animationRef.current = requestAnimationFrame(updateText);
        }
    }, [speed]);

    useEffect(() => {
        // 使用 requestAnimationFrame 而非 setInterval 來提升效能
        lastUpdateRef.current = performance.now();
        animationRef.current = requestAnimationFrame(updateText);

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [updateText]);

    return displayedText;
};