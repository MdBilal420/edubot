"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { useTranscription } from "../hooks/useTranscription";
import InputSidebar from "./InputSidebar";
import OutputSection from "./OutputSection";

export default function Dashboard() {
	const [activeTab, setActiveTab] = useState("transcription");
	const [outputData, setOutputData] = useState({
		transcription: "",
		sentences: [],
		summary: "",
		questions: [],
		audioUrl: "",
		loading: false,
		error: null,
	});
	const [inputType, setInputType] = useState("audio");
	const [sidebarOpen, setSidebarOpen] = useState(true);
	const {
		transcriptionData,
		processAudioFile,
		clearTranscription,
		retryTranscription,
	} = useTranscription();
	const [chatMessages, setChatMessages] = useState([]);

	// Close sidebar by default on mobile
	useEffect(() => {
		const handleResize = () => {
			if (window.innerWidth < 768) {
				setSidebarOpen(false);
			} else {
				setSidebarOpen(true);
			}
		};

		// Initial check
		handleResize();

		// Listen for window resize
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	// When transcription data changes, update output data
	useEffect(() => {
		setOutputData((prev) => ({
			...prev,
			transcription: transcriptionData.transcription,
			sentences: transcriptionData.sentences,
			audioUrl: transcriptionData.audioUrl,
			loading: transcriptionData.loading,
			error: transcriptionData.error,
		}));
	}, [transcriptionData]);

	const handleProcessContent = async (data) => {
		// Close sidebar on mobile after processing
		if (window.innerWidth < 768) {
			setSidebarOpen(false);
		}

		try {
			// Set loading state
			setOutputData((prev) => ({ ...prev, loading: true, error: null }));

			// Handle the processed data from InputSidebar
			if (data.type === "audio") {
				// Process audio file and get transcription
				const result = await processAudioFile(data.file);

				// If successful, generate summary and quiz
				if (result) {
					// Call backend to generate summary
					const summaryResponse = await fetch(
						"http://localhost:8000/api/generate-summary",
						{
							method: "POST",
							headers: {
								"Content-Type": "application/json",
							},
							body: JSON.stringify({
								transcript: result.transcription,
							}),
						}
					);

					let summary = "";
					if (summaryResponse.ok) {
						const summaryData = await summaryResponse.json();
						summary = summaryData.success
							? summaryData.summary
							: "Failed to generate summary";
					}

					// Call backend to generate quiz questions
					const quizResponse = await fetch(
						"http://localhost:8000/api/generate-quiz",
						{
							method: "POST",
							headers: {
								"Content-Type": "application/json",
							},
							body: JSON.stringify({
								transcript: result.transcription,
								num_questions: 5, // Request 5 questions
							}),
						}
					);

					let questions = [];
					if (quizResponse.ok) {
						const quizData = await quizResponse.json();
						questions = quizData.success ? quizData.questions : [];
					}

					// Update output data with all information
					setOutputData((prev) => ({
						...prev,
						summary,
						questions,
						loading: false,
					}));
				}
			} else if (data.type === "pdf") {
				// Handle PDF processing results
				setOutputData({
					transcription: "PDF content will be displayed here...",
					summary: "PDF summary will be displayed here...",
					questions: [],
					loading: false,
					error: null,
				});
			} else if (data.type === "youtube") {
				// Handle YouTube processing results
				setOutputData({
					transcription: "YouTube transcription will be displayed here...",
					summary: "YouTube summary will be displayed here...",
					questions: [],
					loading: false,
					error: null,
				});
			}
		} catch (error) {
			console.error("Error processing content:", error);
			setOutputData((prev) => ({
				...prev,
				loading: false,
				error: error.message || "An unexpected error occurred",
			}));
		}
	};

	const handleRetry = async () => {
		try {
			setActiveTab("transcription"); // Switch to transcription tab
			await retryTranscription();
		} catch (error) {
			console.error("Error retrying transcription:", error);
		}
	};

	return (
		<div className='min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex flex-col md:flex-row'>
			{/* Mobile Header with Menu */}
			<div className='md:hidden flex items-center justify-between p-4 border-b border-emerald-200 bg-white/30 backdrop-blur-sm'>
				<h1 className='text-xl font-bold text-emerald-800'>
					AI Lecture Assistant
				</h1>
				<button
					onClick={() => setSidebarOpen(!sidebarOpen)}
					className='p-2 rounded-lg bg-emerald-100 text-emerald-700'
				>
					{sidebarOpen ? <X size={20} /> : <Menu size={20} />}
				</button>
			</div>

			{/* Sidebar for Inputs */}
			<div
				className={`
				${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"} 
				transition-transform duration-300 ease-in-out
				md:w-72 lg:w-80 bg-white/30 backdrop-blur-lg border-r border-white/40 
				fixed md:static top-0 left-0 h-full z-20 md:z-0
				p-4 flex flex-col
				w-3/4 sm:w-64
			`}
			>
				<div className='hidden md:block mb-6'>
					<h1 className='text-2xl font-bold text-emerald-800'>
						AI Lecture Assistant
					</h1>
					<p className='text-emerald-600 text-sm mt-1'>
						Transform lectures into structured notes
					</p>
				</div>

				<InputSidebar
					onProcessContent={handleProcessContent}
					inputType={inputType}
					setInputType={setInputType}
					error={outputData.error}
				/>
			</div>

			{/* Overlay for mobile */}
			{sidebarOpen && (
				<div
					className='md:hidden fixed inset-0 bg-black bg-opacity-50 z-10'
					onClick={() => setSidebarOpen(false)}
				></div>
			)}

			{/* Main Content for Output */}
			<div className='flex-1 p-4 md:p-6 pt-4 overflow-auto'>
				<OutputSection
					data={outputData}
					activeTab={activeTab}
					setActiveTab={setActiveTab}
					onRetry={handleRetry}
					chatMessages={chatMessages}
					setChatMessages={setChatMessages}
				/>
			</div>

			<Toaster
				position='top-right'
				toastOptions={{
					duration: 3000,
					className: "rounded-md shadow-md",
				}}
			/>
		</div>
	);
}
