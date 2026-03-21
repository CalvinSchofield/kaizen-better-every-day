import { Check, X, Clock, AlertCircle, Building2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOrgRequests, useRespondToOrgRequest, REQUEST_TYPE_LABELS } from "@/hooks/useOrgRequests";
import { formatDistanceToNow } from "date-fns";

interface PendingOrgRequestsProps {
  /** Show only pending approvals for this user (approver view) */
  mode: "approver" | "requester" | "both";
}

export const PendingOrgRequests = ({ mode }: PendingOrgRequestsProps) => {
  const { data, isLoading } = useOrgRequests();
  const respond = useRespondToOrgRequest();

  if (isLoading || !data) return null;

  const { pendingForMe, myRequests } = data;
  const pendingMyRequests = myRequests.filter(r => r.status === 'pending');

  const showApprover = mode === "approver" || mode === "both";
  const showRequester = mode === "requester" || mode === "both";

  if (
    (showApprover && pendingForMe.length === 0 && !showRequester) ||
    (showRequester && pendingMyRequests.length === 0 && !showApprover) ||
    (mode === "both" && pendingForMe.length === 0 && pendingMyRequests.length === 0)
  ) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Pending approvals for me */}
      {showApprover && pendingForMe.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-2 text-amber-600">
            <AlertCircle className="h-4 w-4" />
            Pending Your Approval ({pendingForMe.length})
          </h4>
          {pendingForMe.map((item) => (
            <div
              key={item.approvalId}
              className="border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 rounded-lg p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {item.requestType.includes('team') ? (
                      <Users className="h-3.5 w-3.5 text-blue-500" />
                    ) : (
                      <Building2 className="h-3.5 w-3.5 text-primary" />
                    )}
                    <span className="font-medium text-sm">
                      {REQUEST_TYPE_LABELS[item.requestType] || item.requestType}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Requested by <span className="font-medium">{item.requesterName}</span>
                    {" · "}
                    {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                  </p>
                  {item.requestData?.name && (
                    <p className="text-sm">
                      Name: <span className="font-medium">{item.requestData.name}</span>
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="default"
                  className="gap-1 flex-1"
                  disabled={respond.isPending}
                  onClick={() => respond.mutate({ requestId: item.requestId, approved: true })}
                >
                  <Check className="h-3.5 w-3.5" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 flex-1"
                  disabled={respond.isPending}
                  onClick={() => respond.mutate({ requestId: item.requestId, approved: false })}
                >
                  <X className="h-3.5 w-3.5" />
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* My pending requests */}
      {showRequester && pendingMyRequests.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            Your Pending Requests ({pendingMyRequests.length})
          </h4>
          {pendingMyRequests.map((req) => (
            <div
              key={req.id}
              className="border rounded-lg p-3 space-y-1.5 bg-muted/30"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">
                  {REQUEST_TYPE_LABELS[req.request_type] || req.request_type}
                </span>
                <Badge variant="outline" className="text-[10px]">Pending</Badge>
              </div>
              {req.request_data?.name && (
                <p className="text-xs text-muted-foreground">
                  "{req.request_data.name}"
                </p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {req.approvals.map((a, i) => (
                  <Badge
                    key={i}
                    variant={a.approved === true ? "default" : a.approved === false ? "destructive" : "secondary"}
                    className="text-[10px]"
                  >
                    {a.approverName}
                    {a.approved === true && " ✓"}
                    {a.approved === false && " ✗"}
                    {a.approved === null && " · waiting"}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
