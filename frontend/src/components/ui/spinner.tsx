import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SpinnerProps extends React.SVGProps<SVGSVGElement> {
    size?: number;
    className?: string;
}

export function Spinner({ size = 24, className, ...props }: SpinnerProps) {
    return (
        <Loader2 
            size={size} 
            className={cn('animate-spin text-muted-foreground', className)} 
            {...props} 
        />
    );
}
