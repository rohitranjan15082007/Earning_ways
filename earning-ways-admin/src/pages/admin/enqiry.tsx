import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChevronLeft, ChevronRight, Eye, Trash2, Loader2 } from "lucide-react";
import { useState } from "react";
import { useGetEnquiries, useDeleteEnquiry } from "@/api/hooks/enquiry";
import { toast } from "sonner";

const Enquiry = () => {
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedEnquiry, setSelectedEnquiry] = useState<any>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const limit = 10;
    const { data, isLoading, error, refetch } = useGetEnquiries(
        currentPage,
        limit
    );
    const deleteEnquiry = useDeleteEnquiry();

    const totalPages = data?.pagination?.pages || 1;
    const enquiries = data?.data || [];

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;

        try {
            deleteEnquiry.mutate(deleteId, {
                onSuccess: () => {
                    toast.success("Enquiry deleted successfully");
                    setDeleteId(null);
                    refetch();
                },
                onError: (error: any) => {
                    toast.error(error.message || "Failed to delete enquiry");
                },
            });
        } catch (err) {
            console.error("Delete error:", err);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-IN", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Enquiries</h1>
                    <p className="text-muted-foreground mt-1">Loading...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Enquiries</h1>
                    <p className="text-destructive mt-1">
                        {error instanceof Error ? error.message : "An error occurred"}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-foreground">Enquiries</h1>
                <p className="text-muted-foreground mt-1">
                    Manage and view customer enquiries
                </p>
            </div>

            {/* Enquiries Table */}
            <Card>
                <CardHeader>
                    <CardTitle>All Enquiries ({data?.pagination?.total || 0} total)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-border text-left">
                                    <th className="pb-3 font-semibold text-sm text-muted-foreground">
                                        Name
                                    </th>
                                    <th className="pb-3 font-semibold text-sm text-muted-foreground">
                                        Email
                                    </th>
                                    <th className="pb-3 font-semibold text-sm text-muted-foreground">
                                        Subject
                                    </th>
                                    <th className="pb-3 font-semibold text-sm text-muted-foreground">
                                        Date
                                    </th>
                                    <th className="pb-3 font-semibold text-sm text-muted-foreground">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {enquiries.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-8 text-center text-muted-foreground">
                                            No enquiries found.
                                        </td>
                                    </tr>
                                ) : (
                                    enquiries.map((enquiry: any) => (
                                        <tr key={enquiry.id} className="border-b border-border last:border-0">
                                            <td className="py-4 text-sm font-medium">{enquiry.name}</td>
                                            <td className="py-4 text-sm">{enquiry.email}</td>
                                            <td className="py-4 text-sm">{enquiry.subject}</td>
                                            <td className="py-4 text-sm text-muted-foreground">
                                                {formatDate(enquiry.createdAt)}
                                            </td>
                                            <td className="py-4">
                                                <div className="flex gap-2">
                                                    <Dialog>
                                                        <DialogTrigger asChild>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => setSelectedEnquiry(enquiry)}
                                                                className="h-8"
                                                            >
                                                                <Eye className="w-3 h-3 mr-1" />
                                                                View
                                                            </Button>
                                                        </DialogTrigger>
                                                        <DialogContent className="max-w-2xl">
                                                            <DialogHeader>
                                                                <DialogTitle>Enquiry Details</DialogTitle>
                                                            </DialogHeader>
                                                            {selectedEnquiry && selectedEnquiry.id === enquiry.id && (
                                                                <div className="space-y-4">
                                                                    <div className="grid grid-cols-2 gap-4">
                                                                        <div>
                                                                            <p className="text-sm text-muted-foreground mb-1">
                                                                                Name
                                                                            </p>
                                                                            <p className="font-medium">
                                                                                {selectedEnquiry.name}
                                                                            </p>
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-sm text-muted-foreground mb-1">
                                                                                Phone
                                                                            </p>
                                                                            <p className="font-medium">
                                                                                {selectedEnquiry.phone}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-sm text-muted-foreground mb-1">
                                                                            Email
                                                                        </p>
                                                                        <p className="font-medium">
                                                                            {selectedEnquiry.email}
                                                                        </p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-sm text-muted-foreground mb-1">
                                                                            Subject
                                                                        </p>
                                                                        <p className="text-lg font-semibold">
                                                                            {selectedEnquiry.subject}
                                                                        </p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-sm text-muted-foreground mb-1">
                                                                            Date
                                                                        </p>
                                                                        <p className="text-sm">
                                                                            {formatDate(selectedEnquiry.createdAt)}
                                                                        </p>
                                                                    </div>
                                                                    <div className="w-full min-w-0">
                                                                        <p className="text-sm text-muted-foreground mb-2">
                                                                            Message
                                                                        </p>
                                                                        <div className="bg-muted p-4 rounded-lg w-full min-w-0">
                                                                            <p className="text-sm whitespace-pre-wrap break-all leading-relaxed">
                                                                                {selectedEnquiry.message}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </DialogContent>
                                                    </Dialog>

                                                    <AlertDialog
                                                        open={deleteId === enquiry.id}
                                                        onOpenChange={(open) => {
                                                            if (!open) setDeleteId(null);
                                                        }}
                                                    >
                                                        <Button
                                                            size="sm"
                                                            variant="destructive"
                                                            onClick={() => setDeleteId(enquiry.id)}
                                                            className="h-8"
                                                            disabled={deleteEnquiry.isPending}
                                                        >
                                                            {deleteEnquiry.isPending ? (
                                                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                            ) : (
                                                                <Trash2 className="w-3 h-3 mr-1" />
                                                            )}
                                                            Delete
                                                        </Button>

                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Delete Enquiry</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    Are you sure you want to delete this enquiry? This
                                                                    action cannot be undone.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <div className="flex gap-2 justify-end">
                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                <AlertDialogAction
                                                                    onClick={handleDelete}
                                                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                                    disabled={deleteEnquiry.isPending}
                                                                >
                                                                    {deleteEnquiry.isPending ? (
                                                                        <>
                                                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                                            Deleting...
                                                                        </>
                                                                    ) : (
                                                                        "Delete"
                                                                    )}
                                                                </AlertDialogAction>
                                                            </div>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-6">
                            <div className="text-sm text-muted-foreground">
                                Page {currentPage} of {totalPages}
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1}
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                >
                                    Next
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default Enquiry;
