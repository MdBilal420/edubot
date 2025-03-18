import { AlertCircle, Check, Loader2 } from "lucide-react";
import { toast as sonnerToast } from "sonner";

export const toast = {
	success: (message) => {
		return sonnerToast.success(message, {
			icon: <Check className='h-4 w-4 text-emerald-500' />,
			className: "bg-white border border-emerald-100",
		});
	},
	error: (message) => {
		return sonnerToast.error(message, {
			icon: <AlertCircle className='h-4 w-4 text-red-500' />,
			className: "bg-white border border-red-100",
		});
	},
	loading: (message) => {
		return sonnerToast.loading(message, {
			icon: <Loader2 className='h-4 w-4 text-emerald-500 animate-spin' />,
			className: "bg-white border border-emerald-100",
		});
	},
	dismiss: (id) => {
		sonnerToast.dismiss(id);
	},
};
