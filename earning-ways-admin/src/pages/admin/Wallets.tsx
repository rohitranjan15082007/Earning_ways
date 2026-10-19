// import { Badge } from '@/components/ui/badge';
// import { Button } from '@/components/ui/button';
// import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
// import { transactions, wallets } from '@/data/mockData';
// import { QrCode } from 'lucide-react';
// import { useState } from 'react';

// const Wallets = () => {
//   const [activeTab, setActiveTab] = useState('wallets');

//   return (
//     <div className="space-y-6">
//       {/* Header */}
//       <div>
//         <h1 className="text-3xl font-bold text-foreground">Wallets & Transactions</h1>
//         <p className="text-muted-foreground mt-1">Monitor wallet balances and transactions</p>
//       </div>

//       {/* Tabs */}
//       <Tabs value={activeTab} onValueChange={setActiveTab}>
//         <TabsList className="grid w-full max-w-md grid-cols-2">
//           <TabsTrigger value="wallets">Wallets</TabsTrigger>
//           <TabsTrigger value="transactions">Transactions</TabsTrigger>
//         </TabsList>

//         {/* Wallets Tab */}
//         <TabsContent value="wallets" className="mt-6">
//           <Card>
//             <CardHeader>
//               <CardTitle>User Wallets</CardTitle>
//             </CardHeader>
//             <CardContent>
//               <div className="overflow-x-auto">
//                 <table className="w-full">
//                   <thead>
//                     <tr className="border-b border-border text-left">
//                       <th className="pb-3 font-semibold text-sm text-muted-foreground">User</th>
//                       <th className="pb-3 font-semibold text-sm text-muted-foreground">Wallet Address</th>
//                       <th className="pb-3 font-semibold text-sm text-muted-foreground">Balance</th>
//                       <th className="pb-3 font-semibold text-sm text-muted-foreground">QR Code</th>
//                     </tr>
//                   </thead>
//                   <tbody>
//                     {wallets.map((wallet) => (
//                       <tr key={wallet.id} className="border-b border-border last:border-0">
//                         <td className="py-4 text-sm font-medium">{wallet.user}</td>
//                         <td className="py-4">
//                           <code className="text-xs bg-muted px-2 py-1 rounded">
//                             {wallet.address}
//                           </code>
//                         </td>
//                         <td className="py-4 text-sm font-semibold text-primary">{wallet.balance}</td>
//                         <td className="py-4">
//                           <Button size="sm" variant="outline" className="h-8">
//                             <QrCode className="w-4 h-4 mr-2" />
//                             View
//                           </Button>
//                         </td>
//                       </tr>
//                     ))}
//                   </tbody>
//                 </table>
//               </div>
//             </CardContent>
//           </Card>
//         </TabsContent>

//         {/* Transactions Tab */}
//         <TabsContent value="transactions" className="mt-6">
//           <Card>
//             <CardHeader>
//               <CardTitle>All Transactions</CardTitle>
//             </CardHeader>
//             <CardContent>
//               <div className="overflow-x-auto">
//                 <table className="w-full">
//                   <thead>
//                     <tr className="border-b border-border text-left">
//                       <th className="pb-3 font-semibold text-sm text-muted-foreground">Txn ID</th>
//                       <th className="pb-3 font-semibold text-sm text-muted-foreground">User</th>
//                       <th className="pb-3 font-semibold text-sm text-muted-foreground">Type</th>
//                       <th className="pb-3 font-semibold text-sm text-muted-foreground">Amount</th>
//                       <th className="pb-3 font-semibold text-sm text-muted-foreground">Date</th>
//                       <th className="pb-3 font-semibold text-sm text-muted-foreground">Status</th>
//                     </tr>
//                   </thead>
//                   <tbody>
//                     {transactions.map((transaction) => (
//                       <tr key={transaction.id} className="border-b border-border last:border-0">
//                         <td className="py-4 text-sm">#{transaction.id}</td>
//                         <td className="py-4 text-sm font-medium">{transaction.user}</td>
//                         <td className="py-4">
//                           <Badge variant="outline">{transaction.type}</Badge>
//                         </td>
//                         <td className="py-4 text-sm font-semibold text-primary">{transaction.amount}</td>
//                         <td className="py-4 text-sm text-muted-foreground">{transaction.date}</td>
//                         <td className="py-4">
//                           <Badge variant={
//                             transaction.status === 'Completed' ? 'default' : 'secondary'
//                           }>
//                             {transaction.status}
//                           </Badge>
//                         </td>
//                       </tr>
//                     ))}
//                   </tbody>
//                 </table>
//               </div>
//             </CardContent>
//           </Card>
//         </TabsContent>
//       </Tabs>
//     </div>
//   );
// };

// export default Wallets;
