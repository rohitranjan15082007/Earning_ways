
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Save, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { toast } from 'sonner';

const Settings = () => {
    const { theme, toggleTheme } = useTheme();
    const [platformName, setPlatformName] = useState('Earning Ways');
    const [minWithdrawal, setMinWithdrawal] = useState('10');
    const [supportEmail, setSupportEmail] = useState('support@earningways.com');
    const [supportPhone, setSupportPhone] = useState('+91 90000 00000');
    const [maintenanceMode, setMaintenanceMode] = useState(false);

    const handleSaveGeneral = () => {
        toast.success('General settings saved successfully');
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-foreground">Settings</h1>
                <p className="text-muted-foreground mt-1">Configure platform and admin preferences</p>
            </div>

            {/* Theme Settings */}
            <Card>
                <CardHeader>
                    <CardTitle>Appearance</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <Label>Theme Mode</Label>
                            <p className="text-sm text-muted-foreground">
                                Switch between light and dark mode
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={toggleTheme}
                            className="rounded-full"
                        >
                            {theme === 'light' ? (
                                <Moon className="w-5 h-5" />
                            ) : (
                                <Sun className="w-5 h-5" />
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* General Site Settings */}
            <Card>
                <CardHeader>
                    <CardTitle>General Site Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="platformName">Platform Name</Label>
                        <Input
                            id="platformName"
                            value={platformName}
                            onChange={(e) => setPlatformName(e.target.value)}
                            placeholder="Enter platform name"
                            className="bg-background text-foreground"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="minWithdrawal">Minimum Withdrawal (₹)</Label>
                        <Input
                            id="minWithdrawal"
                            type="number"
                            value={minWithdrawal}
                            onChange={(e) => setMinWithdrawal(e.target.value)}
                            placeholder="10"
                            className="bg-background text-foreground"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="supportEmail">Support Email</Label>
                        <Input
                            id="supportEmail"
                            type="email"
                            value={supportEmail}
                            onChange={(e) => setSupportEmail(e.target.value)}
                            placeholder="support@example.com"
                            className="bg-background text-foreground"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="supportPhone">Support Phone Number</Label>
                        <Input
                            id="supportPhone"
                            value={supportPhone}
                            onChange={(e) => setSupportPhone(e.target.value)}
                            placeholder="+1 (555) 123-4567"
                            className="bg-background text-foreground"
                        />
                    </div>

                    <div className="flex items-center justify-between pt-4">
                        <div className="space-y-1">
                            <Label htmlFor="maintenance">Maintenance Mode</Label>
                            <p className="text-sm text-muted-foreground">
                                Enable to temporarily disable user access
                            </p>
                        </div>
                        <Switch
                            id="maintenance"
                            checked={maintenanceMode}
                            onCheckedChange={setMaintenanceMode}
                        />
                    </div>

                    <Button onClick={handleSaveGeneral} className="w-full mt-6">
                        <Save className="w-4 h-4 mr-2" />
                        Save General Settings
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
};

export default Settings;