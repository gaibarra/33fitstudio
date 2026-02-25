import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Skeleton({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={twMerge(
                clsx('animate-pulse rounded-md bg-stone-200/50', className)
            )}
            {...props}
        />
    );
}
