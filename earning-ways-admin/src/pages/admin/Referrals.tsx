import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/dashboard/StatCard';
import { Badge } from '@/components/ui/badge';
import { GitBranch, IndianRupee, TrendingUp, Users } from 'lucide-react';
import { referrals } from '@/data/mockData';

const Referrals = () => {
  const totalReferrals = referrals.reduce((sum, ref) => sum + ref.totalReferred, 0);
  const activeBonuses = referrals.filter(r => r.status === 'Active').length;
  // The mock money strings are rupees, so the symbol and the grouping commas both go.
  const totalPayouts = referrals.reduce((sum, ref) => sum + parseFloat(ref.totalEarned.replace(/[₹$,]/g, '')), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Referral Management</h1>
        <p className="text-muted-foreground mt-1">Monitor your referrers, their bonus rate and what they earned</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Referrals"
          value={totalReferrals.toString()}
          change="+18.2%"
          icon={Users}
          trend="up"
        />
        <StatCard
          title="Active Bonuses"
          value={activeBonuses.toString()}
          change="+12.5%"
          icon={GitBranch}
          trend="up"
        />
        <StatCard
          title="Total Payouts"
          value={`₹${totalPayouts.toLocaleString('en-IN')}`}
          change="+24.8%"
          icon={IndianRupee}
          trend="up"
        />
        <StatCard
          title="Avg. Referrals"
          value={(totalReferrals / referrals.length).toFixed(1)}
          icon={TrendingUp}
        />
      </div>

      {/* Referrals Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Referrers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-3 font-semibold text-sm text-muted-foreground">Referrer Name</th>
                  <th className="pb-3 font-semibold text-sm text-muted-foreground">Total Referred</th>
                  <th className="pb-3 font-semibold text-sm text-muted-foreground">Bonus %</th>
                  <th className="pb-3 font-semibold text-sm text-muted-foreground">Bonus Duration</th>
                  <th className="pb-3 font-semibold text-sm text-muted-foreground">Total Earned</th>
                  <th className="pb-3 font-semibold text-sm text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((referral) => (
                  <tr key={referral.id} className="border-b border-border last:border-0">
                    <td className="py-4 text-sm font-medium">{referral.referrer}</td>
                    <td className="py-4 text-sm">{referral.totalReferred}</td>
                    <td className="py-4 text-sm font-semibold text-accent">{referral.bonusPercent}</td>
                    <td className="py-4 text-sm">{referral.bonusDuration}</td>
                    <td className="py-4 text-sm font-semibold text-primary">{referral.totalEarned}</td>
                    <td className="py-4">
                      <Badge variant={referral.status === 'Active' ? 'default' : 'secondary'}>
                        {referral.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Referrals;
