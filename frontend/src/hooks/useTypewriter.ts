import { useState, useEffect, useRef } from 'react';

export const useTypewriter = (text: string, speed: number = 25) => {
    const [displayedText, setDisplayedText] = useState('');
    const textRef = useRef(text);
    const indexRef = useRef(0);

    useEffect(() => {
        textRef.current = text;
    }, [text]);

    useEffect(() => {
        const timer = setInterval(() => {
            if (indexRef.current < textRef.current.length) {
                setDisplayedText(textRef.current.substring(0, indexRef.current + 1));
                indexRef.current++;
            } else {
                clearInterval(timer);
            }
        }, speed);

        return () => clearInterval(timer);
    }, [speed]); // Only run once on mount

    return displayedText;
};