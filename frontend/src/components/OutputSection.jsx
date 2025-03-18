import AskTutorTab from "./AskTutorTab";
import QuizTab from "./QuizTab";
import SummaryTab from "./SummaryTab";
import TranscriptionTab from "./TranscriptionTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

// Helper function to format time in MM:SS format
const formatTime = (seconds) => {
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins.toString().padStart(2, "0")}:${secs
		.toString()
		.padStart(2, "0")}`;
};

// Component for displaying transcription with timestamps
const TimestampedTranscription = ({ words }) => {
	if (!words || words.length === 0) {
		return (
			<p className='text-emerald-600 italic'>No timestamped data available</p>
		);
	}

	// Group words into sentences
	const sentences = [];
	let currentSentence = { words: [], startTime: words[0].start };

	words.forEach((word) => {
		currentSentence.words.push(word);
		// If word ends with punctuation, start a new sentence
		if (word.word.match(/[.!?]$/)) {
			sentences.push({
				...currentSentence,
				endTime: word.end,
				text: currentSentence.words.map((w) => w.word).join(" "),
			});
			currentSentence = { words: [], startTime: word.end };
		}
	});

	// Add the last sentence if it's not empty and doesn't end with punctuation
	if (currentSentence.words.length > 0) {
		sentences.push({
			...currentSentence,
			endTime: currentSentence.words[currentSentence.words.length - 1].end,
			text: currentSentence.words.map((w) => w.word).join(" "),
		});
	}

	return (
		<div className='space-y-4'>
			{sentences.map((sentence, idx) => (
				<div
					key={idx}
					className='flex group hover:bg-emerald-50/50 rounded-lg p-2 transition-colors'
				>
					<div className='flex-shrink-0 w-16 text-emerald-500 font-mono text-xs pt-1'>
						{formatTime(sentence.startTime)}
					</div>
					<div className='flex-grow'>
						<p className='text-sm md:text-base text-emerald-900'>
							{sentence.text}
						</p>
					</div>
				</div>
			))}
		</div>
	);
};

export default function OutputSection({
	data,
	activeTab,
	setActiveTab,
	onRetry,
	chatMessages,
	setChatMessages,
}) {
	return (
		<div className='h-full flex flex-col'>
			<div className='mb-4'>
				<h2 className='text-xl md:text-2xl font-semibold text-emerald-800 mb-4'>
					Lecture Analysis
				</h2>

				<div className='w-full overflow-x-auto pb-2'>
					<Tabs
						value={activeTab}
						onValueChange={setActiveTab}
						className='w-full'
					>
						<TabsList className='w-full flex md:grid md:grid-cols-4'>
							<TabsTrigger
								value='transcription'
								className='flex-1 text-xs md:text-sm whitespace-nowrap'
							>
								Transcription
							</TabsTrigger>
							<TabsTrigger
								value='summary'
								className='flex-1 text-xs md:text-sm whitespace-nowrap'
							>
								Summary
							</TabsTrigger>
							<TabsTrigger
								value='quiz'
								className='flex-1 text-xs md:text-sm whitespace-nowrap'
							>
								Test Knowledge
							</TabsTrigger>
							<TabsTrigger
								value='ask'
								className='flex-1 text-xs md:text-sm whitespace-nowrap'
							>
								Ask Tutor
							</TabsTrigger>
						</TabsList>
					</Tabs>
				</div>
			</div>

			<div className='flex-1 bg-white/30 backdrop-blur-lg rounded-xl md:rounded-2xl shadow-lg md:shadow-xl p-3 md:p-6 border border-white/40'>
				<Tabs
					value={activeTab}
					onValueChange={setActiveTab}
					className='h-full flex flex-col'
				>
					<div className='sr-only'>
						<TabsList>
							<TabsTrigger value='transcription'>Transcription</TabsTrigger>
							<TabsTrigger value='summary'>Summary</TabsTrigger>
							<TabsTrigger value='quiz'>Test Knowledge</TabsTrigger>
							<TabsTrigger value='ask'>Ask Tutor</TabsTrigger>
						</TabsList>
					</div>

					<div className='flex-1'>
						<TabsContent value='transcription' className='h-full'>
							<TranscriptionTab data={data} onRetry={onRetry} />
						</TabsContent>

						<TabsContent value='summary' className='h-full'>
							<SummaryTab data={data} />
						</TabsContent>

						<TabsContent value='quiz' className='h-full'>
							<QuizTab data={data} />
						</TabsContent>

						<TabsContent value='ask' className='h-full'>
							<AskTutorTab
								data={data}
								messages={chatMessages}
								setMessages={setChatMessages}
							/>
						</TabsContent>
					</div>
				</Tabs>
			</div>
		</div>
	);
}
