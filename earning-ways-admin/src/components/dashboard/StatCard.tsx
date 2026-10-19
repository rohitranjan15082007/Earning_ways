import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down';
}

export const StatCard = ({ title, value, change, icon: Icon, trend }: StatCardProps) => {
  return (
    <Card className="overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
      <CardContent className="p-6 relative">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold text-foreground">{value}</p>
            {change && (
              <p className={`text-sm font-medium ${
                trend === 'up' ? 'text-success' : 'text-destructive'
              }`}>
                {change}
              </p>
            )}
          </div>
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="w-6 h-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
