import { motion } from "framer-motion";
import { jsPDF } from "jspdf";
import {
	BookOpen,
	Check,
	ChevronRight,
	Download,
	FileDown,
	FileText,
	Loader2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "./ui/toast";

export default function SummaryTab({ data }) {
	const [copied, setCopied] = useState(false);
	const [downloading, setDownloading] = useState(false);

	const copyToClipboard = () => {
		if (data.summary) {
			navigator.clipboard.writeText(data.summary);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	};

	// Parse bullet points for better formatting
	const formatSummary = (summary) => {
		if (!summary) return [];

		// Split by new lines and filter out empty lines
		const lines = summary.split("\n").filter((line) => line.trim());

		// Group lines into sections (optional)
		const sections = [];
		let currentSection = { title: "Key Points", items: [] };

		lines.forEach((line) => {
			const trimmedLine = line.trim();

			// Check if line is a bullet point
			if (
				trimmedLine.startsWith("•") ||
				trimmedLine.startsWith("-") ||
				trimmedLine.startsWith("*")
			) {
				// Remove the bullet character and trim
				const content = trimmedLine.substring(1).trim();
				currentSection.items.push(content);
			} else if (trimmedLine.endsWith(":") && trimmedLine.length > 2) {
				// This might be a section header
				if (currentSection.items.length > 0) {
					sections.push(currentSection);
				}
				currentSection = { title: trimmedLine.slice(0, -1), items: [] };
			} else {
				// Regular line, add as a bullet point
				currentSection.items.push(trimmedLine);
			}
		});

		// Add the last section
		if (currentSection.items.length > 0) {
			sections.push(currentSection);
		}

		return sections.length > 0
			? sections
			: [{ title: "Summary", items: lines }];
	};

	// Download as text file
	const downloadAsText = () => {
		if (!data.summary) return;

		const toastId = toast.loading("Preparing text file...");

		try {
			const blob = new Blob([data.summary], { type: "text/plain" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = "lecture-summary.txt";
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
			toast.dismiss(toastId);
			toast.success("Summary downloaded as text file");
		} catch (error) {
			console.error("Error downloading text:", error);
			toast.dismiss(toastId);
			toast.error("Failed to download summary");
		}
	};

	// Download as PDF
	const downloadAsPDF = () => {
		if (!data.summary) return;

		const toastId = toast.loading("Creating PDF...");

		try {
			const doc = new jsPDF();

			// Set title
			doc.setFontSize(16);
			doc.setTextColor(39, 119, 97); // Emerald color
			doc.text("Lecture Summary", 20, 20);

			// Format summary for PDF
			const formattedSections = formatSummary(data.summary);
			let yPosition = 30;

			formattedSections.forEach((section) => {
				// Section title
				doc.setFontSize(14);
				doc.setTextColor(39, 119, 97); // Emerald color
				doc.text(section.title, 20, yPosition);
				yPosition += 10;

				// Section items
				doc.setFontSize(12);
				doc.setTextColor(60, 60, 60); // Dark gray

				section.items.forEach((item) => {
					// Handle text that may be too long for one line
					const lines = doc.splitTextToSize(`• ${item}`, 170);

					// Check if we need a new page
					if (yPosition + lines.length * 7 > 280) {
						doc.addPage();
						yPosition = 20;
					}

					doc.text(lines, 20, yPosition);
					yPosition += lines.length * 7 + 5;
				});

				yPosition += 5;
			});

			doc.save("lecture-summary.pdf");
			toast.dismiss(toastId);
			toast.success("Summary downloaded as PDF");
		} catch (error) {
			console.error("Error downloading PDF:", error);
			toast.dismiss(toastId);
			toast.error("Failed to create PDF");
		}
	};

	if (data.loading) {
		return (
			<div className='flex flex-col items-center justify-center h-full'>
				<Loader2 className='h-10 w-10 animate-spin text-emerald-600 mb-4' />
				<p className='text-emerald-700'>Generating summary...</p>
			</div>
		);
	}

	if (!data.summary) {
		return (
			<div className='flex flex-col items-center justify-center h-full text-center'>
				<div className='w-12 h-12 md:w-16 md:h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4'>
					<FileText className='h-6 w-6 md:h-8 md:w-8 text-emerald-500' />
				</div>
				<p className='text-emerald-800 font-medium'>No summary available yet</p>
				<p className='text-xs md:text-sm text-emerald-600 mt-2'>
					Process content to generate a summary
				</p>
			</div>
		);
	}

	const formattedSections = formatSummary(data.summary);

	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.5 }}
			className='bg-white/50 rounded-lg p-3 md:p-4 h-full overflow-y-auto'
		>
			<div className='mb-4 flex justify-between items-center flex-wrap gap-2'>
				<div className='flex items-center gap-2'>
					<BookOpen className='h-5 w-5 text-emerald-600' />
					<h3 className='text-lg font-semibold text-emerald-800'>
						Lecture Summary
					</h3>
				</div>

				<div className='flex gap-2'>
					{/* Copy button */}
					<button
						onClick={copyToClipboard}
						className='text-xs bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-2 py-1 rounded-md transition-colors flex items-center gap-1'
						title='Copy to clipboard'
					>
						{copied ? (
							<>
								<Check className='h-3.5 w-3.5' />
								<span>Copied!</span>
							</>
						) : (
							<span>Copy</span>
						)}
					</button>

					{/* Download dropdown */}
					<div className='relative group'>
						<button
							className='text-xs bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-2 py-1 rounded-md transition-colors flex items-center gap-1'
							disabled={downloading}
						>
							<Download className='h-3.5 w-3.5' />
							<span>Download</span>
						</button>

						<div className='absolute right-0 mt-1 w-40 bg-white shadow-lg rounded-md overflow-hidden z-10 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300'>
							<button
								onClick={downloadAsText}
								className='w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-emerald-50 flex items-center gap-2'
								disabled={downloading}
							>
								<FileText className='h-4 w-4 text-emerald-500' />
								<span>Download as Text</span>
							</button>
							<button
								onClick={downloadAsPDF}
								className='w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-emerald-50 flex items-center gap-2'
								disabled={downloading}
							>
								<FileDown className='h-4 w-4 text-emerald-500' />
								<span>Download as PDF</span>
							</button>
						</div>
					</div>
				</div>
			</div>

			<div className='space-y-6'>
				{formattedSections.map((section, idx) => (
					<motion.div
						key={idx}
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.3, delay: idx * 0.1 }}
						className='bg-white/70 rounded-lg p-4 shadow-sm'
					>
						<h4 className='text-emerald-800 font-medium mb-3 border-b border-emerald-100 pb-2'>
							{section.title}
						</h4>
						<ul className='space-y-3'>
							{section.items.map((item, itemIdx) => (
								<motion.li
									key={itemIdx}
									initial={{ opacity: 0, x: -10 }}
									animate={{ opacity: 1, x: 0 }}
									transition={{
										duration: 0.3,
										delay: idx * 0.1 + itemIdx * 0.05,
									}}
									className='flex items-start gap-2'
								>
									<ChevronRight className='h-4 w-4 text-emerald-500 mt-1 flex-shrink-0' />
									<p className='text-emerald-700'>{item}</p>
								</motion.li>
							))}
						</ul>
					</motion.div>
				))}
			</div>
		</motion.div>
	);
}
