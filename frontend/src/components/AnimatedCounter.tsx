import { useEffect, useRef, useState } from 'react';
interface AnimatedCounterProps {
    end: number;
    duration?: number;
    decimals?: number;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
    end,
    duration = 2000,
    decimals = 0,
}) => {
    const [count, setCount] = useState(0);
    const countRef = useRef(0);
    const frameRef = useRef<number>(null);

    useEffect(() => {
        const startTime = Date.now();
        const startValue = 0;
        const endValue = end;

        const animate = () => {
            const currentTime = Date.now();
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function (ease-out)
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const currentValue = startValue + (endValue - startValue) * easeOut;

            countRef.current = currentValue;
            setCount(currentValue);

            if (progress < 1) {
                frameRef.current = requestAnimationFrame(animate);
            } else {
                setCount(endValue); // Ensure we end exactly at the target
            }
        };

        frameRef.current = requestAnimationFrame(animate);

        return () => {
            if (frameRef.current) {
                cancelAnimationFrame(frameRef.current);
            }
        };
    }, [end, duration]);

    return <>{count.toLocaleString(undefined, { maximumFractionDigits: decimals })}</>;
};