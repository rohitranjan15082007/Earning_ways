import { StatCard } from '@/components/dashboard/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, TrendingUp, IndianRupee, ArrowDownToLine } from 'lucide-react';
import { LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { investmentTrendData, investmentDistribution, recentActivities } from '@/data/mockData';
import { Badge } from '@/components/ui/badge';

const Dashboard = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back, Admin</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Users"
          value="2,847"
          change="+12.5%"
          icon={Users}
          trend="up"
        />
        <StatCard
          title="Total Investments"
          value="₹486,250"
          change="+8.3%"
          icon={TrendingUp}
          trend="up"
        />
        <StatCard
          title="Referral Bonuses"
          value="₹24,680"
          change="+15.2%"
          icon={IndianRupee}
          trend="up"
        />
        <StatCard
          title="Total Withdrawals"
          value="₹152,340"
          change="-2.4%"
          icon={ArrowDownToLine}
          trend="down"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Investment Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Investment Growth Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={investmentTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="month" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="amount" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={3}
                  dot={{ fill: 'hsl(var(--primary))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Investment Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Investment Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={investmentDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}%`}
                  outerRadius={100}
                  dataKey="value"
                >
                  {investmentDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activities */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activities</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-3 font-semibold text-sm text-muted-foreground">ID</th>
                  <th className="pb-3 font-semibold text-sm text-muted-foreground">User</th>
                  <th className="pb-3 font-semibold text-sm text-muted-foreground">Type</th>
                  <th className="pb-3 font-semibold text-sm text-muted-foreground">Amount</th>
                  <th className="pb-3 font-semibold text-sm text-muted-foreground">Date</th>
                  <th className="pb-3 font-semibold text-sm text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentActivities.map((activity) => (
                  <tr key={activity.id} className="border-b border-border last:border-0">
                    <td className="py-4 text-sm">#{activity.id}</td>
                    <td className="py-4 text-sm font-medium">{activity.user}</td>
                    <td className="py-4 text-sm">{activity.type}</td>
                    <td className="py-4 text-sm font-semibold text-primary">{activity.amount}</td>
                    <td className="py-4 text-sm text-muted-foreground">{activity.date}</td>
                    <td className="py-4">
                      <Badge variant={
                        activity.status === 'Active' ? 'default' : 
                        activity.status === 'Pending' ? 'secondary' : 
                        'outline'
                      }>
                        {activity.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* System Announcement */}
      <Card className="border-primary/50 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">System Announcement</h3>
              <p className="text-muted-foreground">
                Platform maintenance scheduled for January 20th, 2024 from 2:00 AM - 4:00 AM UTC. 
                All services will be temporarily unavailable during this period.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
