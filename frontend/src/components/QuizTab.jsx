import { AnimatePresence, motion } from "framer-motion";
import {
	ArrowLeft,
	ArrowRight,
	BookOpen,
	CheckCircle2,
	ChevronDown,
	ChevronUp,
	Info,
	Loader2,
	RefreshCw,
	Trophy,
	XCircle,
} from "lucide-react";
import { useState } from "react";

export default function QuizTab({ data }) {
	const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
	const [selectedAnswers, setSelectedAnswers] = useState({});
	const [showResults, setShowResults] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [expandedQuestions, setExpandedQuestions] = useState({});

	// Toggle expanded state for a question in results view
	const toggleExpandQuestion = (idx) => {
		setExpandedQuestions((prev) => ({
			...prev,
			[idx]: !prev[idx],
		}));
	};

	// Handle selecting an answer for the current question
	const handleSelectAnswer = (optionIndex) => {
		if (showResults) return; // Prevent changing answers after submission

		setSelectedAnswers({
			...selectedAnswers,
			[currentQuestionIndex]: optionIndex,
		});
	};

	// Navigate to the next question
	const handleNextQuestion = () => {
		if (currentQuestionIndex < data.questions.length - 1) {
			setCurrentQuestionIndex(currentQuestionIndex + 1);
		} else {
			// If we're on the last question, submit the quiz
			handleSubmitQuiz();
		}
	};

	// Navigate to the previous question
	const handlePrevQuestion = () => {
		if (currentQuestionIndex > 0) {
			setCurrentQuestionIndex(currentQuestionIndex - 1);
		}
	};

	// Submit quiz and show results
	const handleSubmitQuiz = () => {
		setIsSubmitting(true);

		// Simulate a short delay for submission (for UX purposes)
		setTimeout(() => {
			setShowResults(true);
			setIsSubmitting(false);

			// Auto-expand incorrect questions
			const newExpandedState = {};
			data.questions.forEach((q, idx) => {
				if (selectedAnswers[idx] !== q.correct_answer) {
					newExpandedState[idx] = true;
				}
			});
			setExpandedQuestions(newExpandedState);
		}, 1000);
	};

	// Reset the quiz
	const handleResetQuiz = () => {
		setSelectedAnswers({});
		setShowResults(false);
		setCurrentQuestionIndex(0);
		setExpandedQuestions({});
	};

	// Calculate score
	const calculateScore = () => {
		if (!showResults || !data.questions || data.questions.length === 0)
			return 0;

		let correctCount = 0;
		data.questions.forEach((question, index) => {
			if (selectedAnswers[index] === question.correct_answer) {
				correctCount++;
			}
		});

		return correctCount;
	};

	// Generate explanation for incorrect answer (since our backend doesn't provide explanations)
	const generateExplanation = (
		question,
		selectedOptionIndex,
		correctOptionIndex
	) => {
		const selectedOption = question.options[selectedOptionIndex];
		const correctOption = question.options[correctOptionIndex];

		return (
			<div className='space-y-2 text-sm'>
				<p>
					<span className='font-medium'>You selected: </span>
					<span className='text-red-600'>{selectedOption}</span>
				</p>
				<p>
					<span className='font-medium'>Correct answer: </span>
					<span className='text-emerald-600'>{correctOption}</span>
				</p>
				<div className='pt-2 border-t border-gray-200'>
					<p className='font-medium text-gray-700'>Explanation:</p>
					<p className='text-gray-600'>
						The correct answer is "{correctOption}" because it accurately
						reflects the content from the lecture. Your selected answer "
						{selectedOption}" is not supported by the material covered.
					</p>
				</div>
			</div>
		);
	};

	// Loading state
	if (data.loading) {
		return (
			<div className='flex flex-col items-center justify-center h-full'>
				<Loader2 className='h-10 w-10 animate-spin text-emerald-600 mb-4' />
				<p className='text-emerald-700'>Generating quiz questions...</p>
			</div>
		);
	}

	// Empty state
	if (!data.questions || data.questions.length === 0) {
		return (
			<div className='flex flex-col items-center justify-center h-full text-center'>
				<div className='w-12 h-12 md:w-16 md:h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4'>
					<span className='text-xl md:text-2xl font-bold text-emerald-500'>
						?
					</span>
				</div>
				<p className='text-emerald-800 font-medium'>
					No quiz questions available yet
				</p>
				<p className='text-xs md:text-sm text-emerald-600 mt-2'>
					Process content to generate quiz questions
				</p>
			</div>
		);
	}

	// Results view
	if (showResults) {
		const score = calculateScore();
		const totalQuestions = data.questions.length;
		const scorePercentage = Math.round((score / totalQuestions) * 100);

		return (
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5 }}
				className='bg-white/50 rounded-lg p-5 md:p-6 h-full flex flex-col'
			>
				<div className='mb-6 text-center'>
					<h3 className='text-xl font-semibold text-emerald-800 mb-2'>
						Quiz Results
					</h3>
					<p className='text-emerald-600'>You've completed the quiz!</p>
				</div>

				<div className='flex-1 flex flex-col items-center justify-center'>
					<motion.div
						initial={{ scale: 0.8, opacity: 0 }}
						animate={{ scale: 1, opacity: 1 }}
						transition={{ delay: 0.2, duration: 0.5 }}
						className='w-40 h-40 rounded-full bg-white shadow-lg flex items-center justify-center mb-6'
					>
						<div className='text-center'>
							<Trophy
								className={`h-10 w-10 mx-auto mb-2 ${
									scorePercentage >= 70
										? "text-emerald-500"
										: scorePercentage >= 40
										? "text-amber-500"
										: "text-red-500"
								}`}
							/>
							<span className='block text-3xl font-bold text-gray-800'>
								{score}/{totalQuestions}
							</span>
							<span className='text-lg font-medium text-emerald-600'>
								{scorePercentage}%
							</span>
						</div>
					</motion.div>

					<p className='text-center max-w-md mb-6'>
						{scorePercentage >= 70
							? "Great job! You have a good understanding of the material."
							: scorePercentage >= 40
							? "Good effort! Review the questions you missed to improve your understanding."
							: "You might need to review the material again to improve your understanding."}
					</p>

					<div className='w-full max-w-md bg-white/70 rounded-lg p-4 shadow-sm mb-6'>
						<h4 className='font-medium text-emerald-800 mb-3'>
							Question Summary:
						</h4>
						<div className='space-y-2'>
							{data.questions.map((q, idx) => {
								const isCorrect = selectedAnswers[idx] === q.correct_answer;
								const isExpanded = expandedQuestions[idx];
								return (
									<div
										key={idx}
										className={`flex items-center gap-2 text-sm ${
											isCorrect ? "text-emerald-700" : "text-red-700"
										} ${isExpanded ? "border-l-4" : ""} ${
											isCorrect
												? isExpanded
													? "border-l-4 !border-emerald-500"
													: "border-l-4 border-emerald-500"
												: isExpanded
												? "border-l-4 !border-red-500"
												: "border-l-4 border-red-500"
										}`}
									>
										{isCorrect ? (
											<CheckCircle2 className='h-4 w-4 text-emerald-500 flex-shrink-0' />
										) : (
											<XCircle className='h-4 w-4 text-red-500 flex-shrink-0' />
										)}
										<span>
											Question {idx + 1}: {isCorrect ? "Correct" : "Incorrect"}
										</span>
									</div>
								);
							})}
						</div>
					</div>

					<div className='flex items-center gap-2 mb-4'>
						<BookOpen className='h-5 w-5 text-emerald-600' />
						<h4 className='font-medium text-emerald-800'>Question Review</h4>
					</div>

					<div className='flex-1 overflow-y-auto pr-2'>
						<div className='space-y-4'>
							{data.questions.map((question, idx) => {
								const isCorrect =
									selectedAnswers[idx] === question.correct_answer;
								const isExpanded = expandedQuestions[idx];
								return (
									<div
										key={idx}
										className={`bg-white/70 rounded-lg shadow-sm overflow-hidden transition-all ${
											isExpanded ? "border-l-4 border-gray-300" : ""
										} ${
											isCorrect
												? isExpanded
													? "border-l-4 !border-emerald-500"
													: "border-l-4 border-emerald-500"
												: isExpanded
												? "border-l-4 !border-red-500"
												: "border-l-4 border-red-500"
										}`}
									>
										{/* Question header - always visible */}
										<div
											className='p-4 flex items-center justify-between cursor-pointer'
											onClick={() => toggleExpandQuestion(idx)}
										>
											<div className='flex items-center gap-3'>
												{isCorrect ? (
													<CheckCircle2 className='h-5 w-5 text-emerald-500 flex-shrink-0' />
												) : (
													<XCircle className='h-5 w-5 text-red-500 flex-shrink-0' />
												)}
												<span
													className={`${
														isCorrect ? "text-emerald-800" : "text-red-800"
													} font-medium`}
												>
													Question {idx + 1}
												</span>
											</div>
											<div className='flex items-center gap-2'>
												{isCorrect && (
													<span className='text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full'>
														Correct
													</span>
												)}
												{!isCorrect && (
													<span className='text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full'>
														Incorrect
													</span>
												)}
												{isExpanded ? (
													<ChevronUp className='h-5 w-5 text-gray-500' />
												) : (
													<ChevronDown className='h-5 w-5 text-gray-500' />
												)}
											</div>
										</div>

										{/* Expanded content */}
										{isExpanded && (
											<div className='px-4 pb-4 border-t border-gray-100'>
												<div className='mt-3 mb-4'>
													<p className='font-medium text-gray-800'>
														{question.question}
													</p>
												</div>

												<div className='space-y-2'>
													{question.options.map((option, optIdx) => {
														const isSelected = selectedAnswers[idx] === optIdx;
														const isCorrectOption =
															question.correct_answer === optIdx;
														return (
															<div
																key={optIdx}
																className={`p-2 rounded-md flex items-start gap-2 ${
																	isCorrectOption
																		? "bg-emerald-50 border border-emerald-200"
																		: isSelected
																		? "bg-red-50 border border-red-200"
																		: "border border-transparent"
																}`}
															>
																{isCorrectOption ? (
																	<CheckCircle2 className='h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0' />
																) : isSelected ? (
																	<XCircle className='h-4 w-4 text-red-500 mt-0.5 flex-shrink-0' />
																) : (
																	<div className='w-4 h-4 mt-0.5 flex-shrink-0' />
																)}
																<p
																	className={`text-sm ${
																		isCorrectOption
																			? "text-emerald-700 font-medium"
																			: isSelected
																			? "text-red-700"
																			: "text-gray-600"
																	}`}
																>
																	{option}
																</p>
															</div>
														);
													})}
												</div>

												{/* Explanation for incorrect answers */}
												{!isCorrect && (
													<div className='mt-4 bg-blue-50 border border-blue-100 rounded-md p-3'>
														<div className='flex gap-2 items-start'>
															<Info className='h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0' />
															{generateExplanation(
																question,
																selectedAnswers[idx],
																question.correct_answer
															)}
														</div>
													</div>
												)}
											</div>
										)}
									</div>
								);
							})}
						</div>
					</div>
				</div>

				<div className='mt-6 flex justify-center'>
					<button
						onClick={handleResetQuiz}
						className='flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-full font-medium transition-colors'
					>
						<RefreshCw className='h-4 w-4' />
						<span>Retake Quiz</span>
					</button>
				</div>
			</motion.div>
		);
	}

	// Question view - one question at a time
	const currentQuestion = data.questions[currentQuestionIndex];
	const hasSelectedAnswer = selectedAnswers[currentQuestionIndex] !== undefined;
	const totalQuestions = data.questions.length;

	return (
		<div className='bg-white/50 rounded-lg p-4 md:p-5 h-full flex flex-col'>
			{/* Progress bar and navigation */}
			<div className='mb-6'>
				<div className='flex justify-between items-center mb-2'>
					<div className='text-sm font-medium text-emerald-800'>
						Question {currentQuestionIndex + 1} of {totalQuestions}
					</div>
					<div className='text-sm text-emerald-600'>
						{Object.keys(selectedAnswers).length} of {totalQuestions} answered
					</div>
				</div>

				{/* Progress bar */}
				<div className='w-full h-2 bg-gray-200 rounded-full overflow-hidden'>
					<div
						className='h-full bg-emerald-500 transition-all duration-500'
						style={{
							width: `${(currentQuestionIndex / (totalQuestions - 1)) * 100}%`,
						}}
					></div>
				</div>
			</div>

			{/* Current question */}
			<AnimatePresence mode='wait'>
				<motion.div
					key={currentQuestionIndex}
					initial={{ opacity: 0, x: 50 }}
					animate={{ opacity: 1, x: 0 }}
					exit={{ opacity: 0, x: -50 }}
					transition={{ duration: 0.3 }}
					className='flex-1 flex flex-col'
				>
					<div className='bg-white/70 rounded-lg p-4 shadow-sm mb-6'>
						<div className='flex items-start gap-3 mb-4'>
							<div className='w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-medium text-sm flex-shrink-0'>
								{currentQuestionIndex + 1}
							</div>
							<h3 className='text-lg font-medium text-emerald-900'>
								{currentQuestion.question}
							</h3>
						</div>

						<div className='space-y-3 pl-11'>
							{currentQuestion.options.map((option, optIdx) => {
								const isSelected =
									selectedAnswers[currentQuestionIndex] === optIdx;

								return (
									<div
										key={optIdx}
										onClick={() => handleSelectAnswer(optIdx)}
										className={`flex items-start gap-3 p-3 rounded-md cursor-pointer transition-colors ${
											isSelected
												? "bg-emerald-100 border border-emerald-200"
												: "hover:bg-gray-100 border border-transparent"
										}`}
									>
										<div
											className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
												isSelected ? "border-emerald-500" : "border-gray-300"
											}`}
										>
											{isSelected && (
												<div className='w-3 h-3 rounded-full bg-emerald-500' />
											)}
										</div>
										<div className='flex-grow'>
											<p
												className={`${
													isSelected ? "text-emerald-700" : "text-gray-700"
												}`}
											>
												{option}
											</p>
										</div>
									</div>
								);
							})}
						</div>
					</div>
				</motion.div>
			</AnimatePresence>

			{/* Navigation buttons */}
			<div className='flex justify-between mt-auto pt-4'>
				<button
					onClick={handlePrevQuestion}
					disabled={currentQuestionIndex === 0}
					className={`flex items-center gap-1 px-4 py-2 rounded-md ${
						currentQuestionIndex === 0
							? "text-gray-400 cursor-not-allowed"
							: "text-emerald-600 hover:bg-emerald-50"
					}`}
				>
					<ArrowLeft className='h-4 w-4' />
					<span>Previous</span>
				</button>

				<div className='flex gap-2'>
					{/* Progress dots */}
					<div className='hidden md:flex items-center gap-1'>
						{data.questions.map((_, idx) => (
							<div
								key={idx}
								className={`w-2 h-2 rounded-full ${
									currentQuestionIndex === idx
										? "bg-emerald-500"
										: selectedAnswers[idx] !== undefined
										? "bg-emerald-200"
										: "bg-gray-200"
								}`}
							></div>
						))}
					</div>
				</div>

				<button
					onClick={handleNextQuestion}
					disabled={!hasSelectedAnswer}
					className={`flex items-center gap-1 px-4 py-2 rounded-md font-medium ${
						hasSelectedAnswer
							? currentQuestionIndex === totalQuestions - 1
								? "bg-emerald-600 text-white hover:bg-emerald-700"
								: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
							: "bg-gray-100 text-gray-400 cursor-not-allowed"
					}`}
				>
					<span>
						{currentQuestionIndex === totalQuestions - 1
							? "Finish Quiz"
							: "Next"}
					</span>
					<ArrowRight className='h-4 w-4' />
				</button>
			</div>
		</div>
	);
}
