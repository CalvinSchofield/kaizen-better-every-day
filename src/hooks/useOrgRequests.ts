import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getSessionSafe } from "@/utils/authSession";
import { toast } from "@/hooks/use-toast";

interface PendingApproval {
  approvalId: string;
  requestId: string;
  requestType: string;
  requestData: Record<string, any>;
  requestedBy: string;
  requesterName: string;
  createdAt: string;
}

interface MyRequest {
  id: string;
  request_type: string;
  request_data: Record<string, any>;
  status: string;
  created_at: string;
  resolved_at: string | null;
  approvals: Array<{
    approverName: string;
    approverRole: string;
    approved: boolean | null;
    respondedAt: string | null;
  }>;
}

interface OrgRequestsData {
  pendingForMe: PendingApproval[];
  myRequests: MyRequest[];
}

export const useOrgRequests = () => {
  return useQuery({
    queryKey: ["org-change-requests"],
    queryFn: async () => {
      const { session } = await getSessionSafe();
      if (!session) return { pendingForMe: [], myRequests: [] } as OrgRequestsData;

      const { data, error } = await supabase.functions.invoke("manage-org-request", {
        body: { action: "fetch_pending" },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      return data as OrgRequestsData;
    },
    staleTime: 1000 * 60 * 2,
  });
};

export const useSubmitOrgRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestType, requestData }: { requestType: string; requestData: Record<string, any> }) => {
      const { session } = await getSessionSafe();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("manage-org-request", {
        body: { action: "create_request", requestType, requestData },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.directExecution) {
        toast({ title: "Change applied directly" });
      } else {
        toast({ title: "Request submitted", description: data.message });
      }
      queryClient.invalidateQueries({ queryKey: ["org-change-requests"] });
      queryClient.invalidateQueries({ queryKey: ["org-structure"] });
      queryClient.invalidateQueries({ queryKey: ["team-access"] });
    },
    onError: (err: any) => {
      toast({
        title: "Error submitting request",
        description: err?.message || "Unknown error",
        variant: "destructive",
      });
    },
  });
};

export const useRespondToOrgRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, approved }: { requestId: string; approved: boolean }) => {
      const { session } = await getSessionSafe();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("manage-org-request", {
        body: { action: "respond", requestId, approved },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const msg = data.status === 'approved' && data.executed
        ? "Approved! Change has been applied."
        : data.status === 'rejected'
        ? "Request rejected."
        : "Response recorded. Waiting for remaining approvals.";
      toast({ title: msg });
      queryClient.invalidateQueries({ queryKey: ["org-change-requests"] });
      queryClient.invalidateQueries({ queryKey: ["org-structure"] });
      queryClient.invalidateQueries({ queryKey: ["org-structure-data"] });
      queryClient.invalidateQueries({ queryKey: ["team-access"] });
      queryClient.invalidateQueries({ queryKey: ["recruiter-tree-data"] });
      queryClient.invalidateQueries({ queryKey: ["group-recruits"] });
    },
    onError: (err: any) => {
      toast({
        title: "Error responding",
        description: err?.message || "Unknown error",
        variant: "destructive",
      });
    },
  });
};

export const REQUEST_TYPE_LABELS: Record<string, string> = {
  create_team: "Create Team",
  create_mgmt_group: "Create Management Group",
  create_sr_mgmt_group: "Create Sr. Management Group",
  create_region: "Create Region",
  create_sr_region: "Create Sr. Region",
  create_partner: "Create Partner Group",
  create_division: "Create Division",
};
