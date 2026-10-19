import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Bell, Megaphone, Send, X, Search, Check, Users } from "lucide-react"; // Added Users icon
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useAllUsers } from "@/api/hooks/useUser";

// --- Types ---
interface Notification {
    id: string;
    title: string;
    message: string;
    type: "INFO" | "SUCCESS" | "WARNING" | "ERROR" | "PROMOTIONAL" | "SYSTEM";
    createdAt: string;
    updatedAt: string;
}

interface User {
    id: string;
    name: string | null;
    email: string;
}

// --- Hooks ---
const useNotifications = () => {
    return useQuery<Notification[]>({
        queryKey: ['notifications'],
        queryFn: async () => {
            const { data } = await api.get('/notifications/all');
            return data.data;
        },
    });
};

const useCreateNotification = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (newNotification: any) => {
            // Note: Ensure your backend handles 'userIds: []' as "Send to All" logic
            const { data } = await api.post('/notifications/create', newNotification);
            return data.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            toast.success("Notification sent successfully");
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || "Failed to create notification");
        },
    });
};

// --- Helper: Simple Debounce Hook ---
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

const Notifications = () => {
    const { data: notifications = [], isLoading: isFetching } = useNotifications();
    const createMutation = useCreateNotification();

    // --- Form State ---
    const [formData, setFormData] = useState({
        title: "",
        message: "",
        type: "INFO" as "INFO" | "SUCCESS" | "WARNING" | "ERROR" | "PROMOTIONAL" | "SYSTEM",
    });

    // --- User Selection State ---
    const [userSearch, setUserSearch] = useState("");
    const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    // Debounce search 
    const debouncedSearch = useDebounce(userSearch, 500);

    // Use Infinite Query Hook (Fetching only 1st page for dropdown suggestions)
    const { data: userResponse, isLoading: isLoadingUsers } = useAllUsers(10, debouncedSearch);

    // Flatten pages to get users list for the dropdown
    const foundUsers = userResponse?.pages.flatMap(page => page.data.users) || [];

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.title || !formData.message) {
            toast.error("Please fill in title and message");
            return;
        }

        // LOGIC CHANGE: 
        // If selectedUsers is empty, we send empty array.
        // The Backend should interpret empty array as "Global Notification" (All Users).
        const userIds = selectedUsers.map(u => u.id);

        createMutation.mutate({
            title: formData.title,
            message: formData.message,
            type: formData.type,
            userIds: userIds // Empty = All Users, Populated = Specific Users
        });

        // Reset form
        setFormData({ title: "", message: "", type: "INFO" });
        setSelectedUsers([]);
        setUserSearch("");
    };

    const toggleUserSelection = (user: User) => {
        if (selectedUsers.find(u => u.id === user.id)) {
            setSelectedUsers(prev => prev.filter(u => u.id !== user.id));
        } else {
            setSelectedUsers(prev => [...prev, user]);
        }
    };

    const removeUser = (userId: string) => {
        setSelectedUsers(prev => prev.filter(u => u.id !== userId));
    };

    return (
        <div className="space-y-6 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Notification Manager</h1>
                    <p className="text-muted-foreground mt-1">Send alerts and updates to users</p>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* --- Create Notification Form --- */}
                <Card className="h-fit">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Megaphone className="w-5 h-5 text-primary" />
                            Compose Notification
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleCreate} className="space-y-4">
                            {/* Title Input */}
                            <div className="space-y-2">
                                <Label htmlFor="title">Title</Label>
                                <Input
                                    id="title"
                                    placeholder="e.g. System Maintenance Update"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                />
                            </div>

                            {/* Type Selection */}
                            <div className="space-y-2">
                                <Label>Notification Type</Label>
                                <Select
                                    value={formData.type}
                                    onValueChange={(val: any) => setFormData({ ...formData, type: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="INFO">Info</SelectItem>
                                        <SelectItem value="SUCCESS">Success</SelectItem>
                                        <SelectItem value="WARNING">Warning</SelectItem>
                                        <SelectItem value="ERROR">Error</SelectItem>
                                        <SelectItem value="PROMOTIONAL">Promotional</SelectItem>
                                        <SelectItem value="SYSTEM">System</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Target Audience (User Search) */}
                            <div className="space-y-2 relative">
                                <Label className="flex justify-between">
                                    Target Audience
                                    <span className={`text-xs ${selectedUsers.length === 0 ? "text-blue-500 font-bold" : "text-muted-foreground"}`}>
                                        {selectedUsers.length === 0 ? "(Sending to ALL Users)" : `(Selected: ${selectedUsers.length})`}
                                    </span>
                                </Label>

                                {/* Selected Users Chips */}
                                {selectedUsers.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-2 p-2 bg-secondary/20 rounded-md border border-dashed max-h-[100px] overflow-y-auto">
                                        {selectedUsers.map(user => (
                                            <div key={user.id} className="bg-background border flex items-center gap-1 px-2 py-1 rounded text-xs font-medium shadow-sm">
                                                <span>{user.name || user.email}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => removeUser(user.id)}
                                                    className="text-muted-foreground hover:text-destructive"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Search Input */}
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder={selectedUsers.length === 0 ? "Leave empty to send to EVERYONE, or type to search..." : "Search to add more users..."}
                                        className="pl-9"
                                        value={userSearch}
                                        onChange={(e) => {
                                            setUserSearch(e.target.value);
                                            setIsSearchOpen(true);
                                        }}
                                        onFocus={() => setIsSearchOpen(true)}
                                    />
                                </div>

                                {/* Dropdown Results */}
                                {isSearchOpen && (userSearch || foundUsers.length > 0) && (
                                    <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-md max-h-[200px] overflow-y-auto">
                                        {isLoadingUsers ? (
                                            <div className="p-3 text-sm text-center text-muted-foreground">Searching...</div>
                                        ) : foundUsers.length === 0 ? (
                                            <div className="p-3 text-sm text-center text-muted-foreground">No users found</div>
                                        ) : (
                                            foundUsers.map((user: User) => {
                                                const isSelected = selectedUsers.some(u => u.id === user.id);
                                                return (
                                                    <div
                                                        key={user.id}
                                                        onClick={() => toggleUserSelection(user)}
                                                        className={`flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-accent ${isSelected ? 'bg-accent/50' : ''}`}
                                                    >
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">{user.name || "No Name"}</span>
                                                            <span className="text-xs text-muted-foreground">{user.email}</span>
                                                        </div>
                                                        {isSelected && <Check className="w-4 h-4 text-primary" />}
                                                    </div>
                                                );
                                            })
                                        )}
                                        <div
                                            className="p-2 border-t text-xs text-center text-blue-500 cursor-pointer hover:bg-accent"
                                            onClick={() => setIsSearchOpen(false)}
                                        >
                                            Close List
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Message Input */}
                            <div className="space-y-2">
                                <Label htmlFor="message">Message</Label>
                                <Textarea
                                    id="message"
                                    placeholder="Write your notification content..."
                                    className="min-h-[120px]"
                                    value={formData.message}
                                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                />
                            </div>

                            <Button
                                type="submit"
                                className="w-full"
                                disabled={createMutation.isPending}
                                variant={selectedUsers.length === 0 ? "default" : "secondary"}
                            >
                                <Send className="w-4 h-4 mr-2" />
                                {createMutation.isPending
                                    ? "Sending..."
                                    : selectedUsers.length === 0
                                        ? "Broadcast to ALL Users" // Button text changes dynamically
                                        : `Send to ${selectedUsers.length} Selected User${selectedUsers.length !== 1 ? 's' : ''}`
                                }
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* --- Recent Notifications List --- */}
                <Card className="h-full max-h-[800px] flex flex-col">
                    <CardHeader>
                        <CardTitle>History</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto pr-2">
                        <div className="space-y-4">
                            {isFetching ? (
                                <p className="text-center text-muted-foreground py-8">Loading history...</p>
                            ) : notifications.length === 0 ? (
                                <div className="text-center py-10 space-y-3">
                                    <Bell className="w-10 h-10 text-muted-foreground mx-auto opacity-20" />
                                    <p className="text-muted-foreground">No notifications sent yet.</p>
                                </div>
                            ) : (
                                notifications.map((notification) => (
                                    <div key={notification.id} className="flex gap-4 p-4 rounded-lg border bg-card hover:bg-accent/30 transition-all">
                                        <div className={`mt-1 p-2 rounded-full h-fit shrink-0 ${notification.type === 'INFO' ? 'bg-blue-100 text-blue-600' :
                                                notification.type === 'SUCCESS' ? 'bg-green-100 text-green-600' :
                                                    notification.type === 'WARNING' ? 'bg-yellow-100 text-yellow-600' :
                                                        notification.type === 'ERROR' ? 'bg-red-100 text-red-600' :
                                                            'bg-gray-100 text-gray-600'
                                            }`}>
                                            <Bell className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 space-y-1">
                                            <div className="flex items-center justify-between">
                                                <h4 className="font-semibold text-sm">{notification.title}</h4>
                                                <span className="text-[10px] text-muted-foreground">
                                                    {new Date(notification.createdAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <p className="text-sm text-muted-foreground leading-relaxed">
                                                {notification.message}
                                            </p>
                                            <div className="pt-2">
                                                <span className="text-[10px] px-2 py-0.5 rounded-full border bg-background font-medium uppercase tracking-wider">
                                                    {notification.type}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default Notifications;