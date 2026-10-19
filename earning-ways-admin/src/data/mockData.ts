export const investmentTrendData = [
  { month: 'Jan', amount: 45000 },
  { month: 'Feb', amount: 52000 },
  { month: 'Mar', amount: 48000 },
  { month: 'Apr', amount: 61000 },
  { month: 'May', amount: 68000 },
  { month: 'Jun', amount: 75000 },
];

export const investmentDistribution = [
  { name: 'Active', value: 65, fill: 'hsl(var(--primary))' },
  { name: 'Completed', value: 35, fill: 'hsl(var(--accent))' },
];

export const recentActivities = [
  { id: 1, user: 'John Doe', type: 'Investment', amount: '₹5,000', date: '2024-01-15', status: 'Active' },
  { id: 2, user: 'Jane Smith', type: 'Withdrawal', amount: '₹2,500', date: '2024-01-15', status: 'Pending' },
  { id: 3, user: 'Mike Johnson', type: 'Referral Bonus', amount: '₹150', date: '2024-01-14', status: 'Completed' },
  { id: 4, user: 'Sarah Wilson', type: 'Investment', amount: '₹10,000', date: '2024-01-14', status: 'Active' },
  { id: 5, user: 'Tom Brown', type: 'ROI Payout', amount: '₹750', date: '2024-01-13', status: 'Completed' },
];

export const users = [
  { 
    id: 1, 
    name: 'John Doe', 
    email: 'john@example.com', 
    balance: '12,450', 
    level: 'Gold', 
    referrals: 15, 
    status: 'Active',
    referralCode: 'JOHN2024' 
  },
  { 
    id: 2, 
    name: 'Jane Smith', 
    email: 'jane@example.com', 
    balance: '8,320', 
    level: 'Silver', 
    referrals: 8, 
    status: 'Active',
    referralCode: 'JANE8732' 
  },
  { 
    id: 3, 
    name: 'Mike Johnson', 
    email: 'mike@example.com', 
    balance: '25,100', 
    level: 'Platinum', 
    referrals: 32, 
    status: 'Active',
    referralCode: 'MIKE5491' 
  },
  { 
    id: 4, 
    name: 'Sarah Wilson', 
    email: 'sarah@example.com', 
    balance: '5,670', 
    level: 'Bronze', 
    referrals: 4, 
    status: 'Active',
    referralCode: 'SARA3210' 
  },
  { 
    id: 5, 
    name: 'Tom Brown', 
    email: 'tom@example.com', 
    balance: '18,900', 
    level: 'Gold', 
    referrals: 21, 
    status: 'Blocked',
    referralCode: 'TOMB6789' 
  },
];

export const investments = [
  {
    id: 1,
    user: 'John Doe',
    plan: 'Basic Plan',
    amount: '₹5,000',
    roi: '10%',
    duration: '6 months',
    status: 'Active',
    startDate: '2024-01-01',
    endDate: '2024-07-01'
  },
  {
    id: 2,
    user: 'Jane Smith',
    plan: 'Pro Plan',
    amount: '₹10,000',
    roi: '15%',
    duration: '12 months',
    status: 'Active',
    startDate: '2024-01-05',
    endDate: '2025-01-05'
  },
  {
    id: 3,
    user: 'Mike Johnson',
    plan: 'Elite Plan',
    amount: '₹25,000',
    roi: '20%',
    duration: '12 months',
    status: 'Active',
    startDate: '2023-12-15',
    endDate: '2024-12-15'
  },
  {
    id: 4,
    user: 'Sarah Wilson',
    plan: 'Basic Plan',
    amount: '₹3,000',
    roi: '10%',
    duration: '6 months',
    status: 'Completed',
    startDate: '2023-07-01',
    endDate: '2024-01-01'
  },
  {
    id: 5,
    user: 'Tom Brown',
    plan: 'Pro Plan',
    amount: '₹15,000',
    roi: '15%',
    duration: '12 months',
    status: 'Active',
    startDate: '2023-11-01',
    endDate: '2024-11-01'
  },
];

export const referrals = [
  {
    id: 1,
    referrer: 'John Doe',
    totalReferred: 15,
    currentLevel: 'Gold',
    bonusPercent: '15%',
    bonusDuration: '12 months',
    status: 'Active',
    totalEarned: '₹2,250'
  },
  {
    id: 2,
    referrer: 'Jane Smith',
    totalReferred: 8,
    currentLevel: 'Silver',
    bonusPercent: '10%',
    bonusDuration: '6 months',
    status: 'Active',
    totalEarned: '₹1,200'
  },
  {
    id: 3,
    referrer: 'Mike Johnson',
    totalReferred: 32,
    currentLevel: 'Platinum',
    bonusPercent: '20%',
    bonusDuration: '24 months',
    status: 'Active',
    totalEarned: '₹6,400'
  },
  {
    id: 4,
    referrer: 'Sarah Wilson',
    totalReferred: 4,
    currentLevel: 'Bronze',
    bonusPercent: '5%',
    bonusDuration: '3 months',
    status: 'Active',
    totalEarned: '₹600'
  },
  {
    id: 5,
    referrer: 'Tom Brown',
    totalReferred: 21,
    currentLevel: 'Gold',
    bonusPercent: '15%',
    bonusDuration: '12 months',
    status: 'Expired',
    totalEarned: '₹3,150'
  },
];

export const withdrawals = [
  {
    id: 1,
    user: 'John Doe',
    amount: '₹2,500',
    destination: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    date: '2024-01-15',
    status: 'Pending'
  },
  {
    id: 2,
    user: 'Jane Smith',
    amount: '₹1,800',
    destination: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    date: '2024-01-14',
    status: 'Approved'
  },
  {
    id: 3,
    user: 'Mike Johnson',
    amount: '₹5,000',
    destination: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    date: '2024-01-14',
    status: 'Pending'
  },
  {
    id: 4,
    user: 'Sarah Wilson',
    amount: '₹750',
    destination: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    date: '2024-01-13',
    status: 'Approved'
  },
  {
    id: 5,
    user: 'Tom Brown',
    amount: '₹3,200',
    destination: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
    date: '2024-01-12',
    status: 'Rejected'
  },
];

export const transfers = [
  {
    id: 1,
    sender: 'John Doe',
    receiver: 'Jane Smith',
    amount: '₹500',
    status: 'Successful',
    date: '2024-01-15'
  },
  {
    id: 2,
    sender: 'Mike Johnson',
    receiver: 'Sarah Wilson',
    amount: '₹1,200',
    status: 'Successful',
    date: '2024-01-14'
  },
  {
    id: 3,
    sender: 'Tom Brown',
    receiver: 'John Doe',
    amount: '₹300',
    status: 'Failed',
    date: '2024-01-14'
  },
  {
    id: 4,
    sender: 'Sarah Wilson',
    receiver: 'Mike Johnson',
    amount: '₹800',
    status: 'Successful',
    date: '2024-01-13'
  },
  {
    id: 5,
    sender: 'Jane Smith',
    receiver: 'Tom Brown',
    amount: '₹450',
    status: 'Successful',
    date: '2024-01-12'
  },
];

export const roiData = [
  {
    id: 1,
    user: 'John Doe',
    investment: '₹5,000',
    roiAmount: '₹125',
    week: 4,
    referralBonus: 'Yes',
    date: '2024-01-15'
  },
  {
    id: 2,
    user: 'Jane Smith',
    investment: '₹10,000',
    roiAmount: '₹312',
    week: 8,
    referralBonus: 'No',
    date: '2024-01-14'
  },
  {
    id: 3,
    user: 'Mike Johnson',
    investment: '₹25,000',
    roiAmount: '₹1,042',
    week: 12,
    referralBonus: 'Yes',
    date: '2024-01-14'
  },
  {
    id: 4,
    user: 'Sarah Wilson',
    investment: '₹3,000',
    roiAmount: '₹75',
    week: 2,
    referralBonus: 'No',
    date: '2024-01-13'
  },
  {
    id: 5,
    user: 'Tom Brown',
    investment: '₹15,000',
    roiAmount: '₹468',
    week: 6,
    referralBonus: 'Yes',
    date: '2024-01-12'
  },
];

export const weeklyRoiData = [
  { week: 'Week 1', amount: 12500 },
  { week: 'Week 2', amount: 15800 },
  { week: 'Week 3', amount: 14200 },
  { week: 'Week 4', amount: 18900 },
  { week: 'Week 5', amount: 22100 },
  { week: 'Week 6', amount: 19500 },
];

export const supportTickets = [
  {
    id: 1,
    user: 'John Doe',
    subject: 'Withdrawal pending for 3 days',
    date: '2024-01-15',
    status: 'Open',
    message: 'My withdrawal request has been pending for 3 days. Please help.'
  },
  {
    id: 2,
    user: 'Jane Smith',
    subject: 'Unable to see referral bonus',
    date: '2024-01-14',
    status: 'Resolved',
    message: 'I referred 5 users but the bonus is not showing in my account.'
  },
  {
    id: 3,
    user: 'Mike Johnson',
    subject: 'Investment plan upgrade',
    date: '2024-01-14',
    status: 'Open',
    message: 'How can I upgrade my current plan from Basic to Pro?'
  },
  {
    id: 4,
    user: 'Sarah Wilson',
    subject: 'Account verification issue',
    date: '2024-01-13',
    status: 'Open',
    message: 'My KYC documents were rejected. Need clarification.'
  },
  {
    id: 5,
    user: 'Tom Brown',
    subject: 'ROI calculation question',
    date: '2024-01-12',
    status: 'Resolved',
    message: 'Can you explain how the weekly ROI is calculated?'
  },
];

export const wallets = [
  {
    id: 1,
    user: 'John Doe',
    address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    balance: '₹12,450',
  },
  {
    id: 2,
    user: 'Jane Smith',
    address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    balance: '₹8,320',
  },
  {
    id: 3,
    user: 'Mike Johnson',
    address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    balance: '₹25,100',
  },
  {
    id: 4,
    user: 'Sarah Wilson',
    address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    balance: '₹5,670',
  },
];

export const transactions = [
  {
    id: 1,
    user: 'John Doe',
    type: 'Deposit',
    amount: '₹5,000',
    status: 'Completed',
    date: '2024-01-15',
  },
  {
    id: 2,
    user: 'Jane Smith',
    type: 'Withdrawal',
    amount: '₹2,500',
    status: 'Pending',
    date: '2024-01-15',
  },
  {
    id: 3,
    user: 'Mike Johnson',
    type: 'ROI',
    amount: '₹1,200',
    status: 'Completed',
    date: '2024-01-14',
  },
  {
    id: 4,
    user: 'Sarah Wilson',
    type: 'Referral Bonus',
    amount: '₹150',
    status: 'Completed',
    date: '2024-01-14',
  },
  {
    id: 5,
    user: 'Tom Brown',
    type: 'Transfer',
    amount: '₹500',
    status: 'Completed',
    date: '2024-01-13',
  },
];
