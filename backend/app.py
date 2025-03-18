# backend/app.py

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import shutil
import uuid
from deepgram import DeepgramClient, PrerecordedOptions
from dotenv import load_dotenv
from fastapi.responses import StreamingResponse
import json
import asyncio
from enum import Enum
import time


app = FastAPI()

# Add CORS middleware to allow frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

load_dotenv()


# Get API key from environment variable
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
if not DEEPGRAM_API_KEY:
    raise ValueError("Missing DEEPGRAM_API_KEY environment variable")

# Get Groq API key from environment variable
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    print("Warning: GROQ_API_KEY environment variable not set. Summary generation will be limited.")

# Initialize Groq client if API key is available
groq_client = None
if GROQ_API_KEY:
    try:
        from groq import Groq
        groq_client = Groq(api_key=GROQ_API_KEY)
    except ImportError:
        print("Warning: Groq package not installed. Install with: pip install groq")

# Create uploads directory if it doesn't exist
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Define the teaching modes
class TeachingMode(str, Enum):
    SOCRATIC = "socratic"
    FIVE_YEAR_OLD = "five_year_old"
    HIGH_SCHOOL = "high_school"
    COLLEGE = "college"
    PHD = "phd"

# endpoint returns hello world
@app.get("/")
async def root():
    return {"message": "Hello World"}

async def transcribe_audio(file_path):
    if not DEEPGRAM_API_KEY:
        # Return mock transcription with timestamps for development
        return {
            "transcript": "This is a mock transcription for development purposes. Please set the DEEPGRAM_API_KEY environment variable for actual transcription.",
            "words": [
                {"word": "This", "start": 0.0, "end": 0.3},
                {"word": "is", "start": 0.3, "end": 0.5},
                {"word": "a", "start": 0.5, "end": 0.6},
                {"word": "mock", "start": 0.6, "end": 0.9},
                {"word": "transcription", "start": 0.9, "end": 1.5},
                {"word": "for", "start": 1.5, "end": 1.8},
                {"word": "development", "start": 1.8, "end": 2.5},
                {"word": "purposes", "start": 2.5, "end": 3.1}
            ]
        }
    
    try:
        # Only import Deepgram if API key is available
        from deepgram import DeepgramClient, PrerecordedOptions
        
        # Initialize the Deepgram client
        deepgram = DeepgramClient(DEEPGRAM_API_KEY)
        
        # Open the audio file
        with open(file_path, 'rb') as buffer_data:
            # Configure transcription options
            payload = { 'buffer': buffer_data }
            options = PrerecordedOptions(
                smart_format=True,
                model="nova-2",
                language="en-US",
                utterances=True,  # Enable utterances to get paragraph breaks
                detect_topics=True,  # Detect topic changes
                punctuate=True,
                diarize=True,  # Speaker diarization if multiple speakers
            )
            
            # Send the audio to Deepgram and get the response
            response = deepgram.listen.prerecorded.v("1").transcribe_file(payload, options)
            
            # Extract full transcript
            transcript = response.results.channels[0].alternatives[0].transcript
            
            # Extract sentences with timestamps            
            paragraphs = response.results.channels[0].alternatives[0].paragraphs.paragraphs

            
            # Format word timestamps
            formatted_sentences = []

            for paragraph in paragraphs:
                for sentence in paragraph.sentences:
                    formatted_sentences.append({
                        "text": sentence.text,
                        "start": sentence.start,
                        "end": sentence.end
                    })
            
            return {
                "transcript": transcript,
                "sentences": formatted_sentences
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error during transcription: {str(e)}")

@app.post("/api/transcribe")
async def transcribe_audio_endpoint(file: UploadFile = File(...)):
    """
    Endpoint to upload an audio file and get its transcription
    """
    # Validate file type (optional)
    if not file.content_type.startswith('audio/'):
        raise HTTPException(status_code=400, detail="File must be an audio file")
    
    # Create a unique filename
    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    # Save uploaded file
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving file: {str(e)}")
    
    # Transcribe the audio
    try:
        transcription_result = await transcribe_audio(file_path)
        
        # Return the transcription with timestamps
        return {
            "success": True,
            "filename": file.filename,
            "transcription": transcription_result["transcript"],
            "sentences": transcription_result["sentences"]
        }
    except Exception as e:
        # Clean up the file in case of error
        if os.path.exists(file_path):
            os.remove(file_path)
        raise e
    finally:
        # Clean up after processing (optional - you might want to keep files)
        if os.path.exists(file_path):
            os.remove(file_path)

def generate_bullet_summary(transcript):
    """
    Generate a bullet-point summary of a transcript using Groq API
    """
    if not GROQ_API_KEY or not groq_client:
        # Return mock summary if Groq API is not available
        return """
        • This is a mock summary for development purposes.
        • Please set the GROQ_API_KEY environment variable for actual summary generation.
        • The real summary would extract key points from the transcript.
        • It would be organized as a bullet-point list for easy reading.
        """
        
    try:
        # Define the prompt for generating bullet point summaries
        prompt = f"""
        Create a concise and well-organized bullet point summary for the provided transcript.

        - Identify key points and important details from the transcript.
        - Summarize information in clear and concise bullet points.
        - Ensure that the bullet points capture the essence of the conversation or content.
        - Organize the bullets logically to maintain the flow of information.

        # Steps

        1. Read through the transcript to understand the main topics and key details.
        2. Identify and note down significant points, arguments, or data.
        3. Summarize these points into clear, concise bullet points.
        4. Ensure logical flow and organization of bullet points.
        5. Review the bullet points to ensure they are representative of the transcript's content.

        # Output Format

        - Summary should be in bullet points
        - Concise and clear sentences
        - Organized logically following the sequence of topics in the transcript

        # Examples

        ## Example Input
        [Transcript of a conversation or presentation.]

        ## Example Output
        - Introduction of the main topic
        - Key argument 1: [Summary of the argument]
        - Key argument 2: [Summary of the argument]
        - Closing remarks: [Summary of conclusions]
        (Note: In a realistic example, more detailed key points should be included.) 

        # Notes

        - Focus on clarity and brevity.
        - Avoid redundant information.
        
        Transcript:
        {transcript}
        """
        
        # Call Groq API to generate the summary
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",  # Using newer Llama 3.3 70B model
            messages=[
                {"role": "system", "content": "You are a helpful assistant that creates concise, well-organized bullet point summaries."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,  # Lower temperature for more focused responses
            max_tokens=1024
        )
        
        # Extract the summary from the response
        summary = response.choices[0].message.content
        return summary
    except Exception as e:
        return f"Error generating summary: {str(e)}"

# Define request and response models for the summary endpoint
class SummaryRequest(BaseModel):
    transcript: str

class SummaryResponse(BaseModel):
    success: bool
    summary: str

@app.post("/api/generate-summary", response_model=SummaryResponse)
async def generate_summary_endpoint(request: SummaryRequest):
    """
    Endpoint to generate a bullet-point summary from a transcript
    """
    try:
        if not request.transcript:
            raise HTTPException(status_code=400, detail="Transcript is required")
            
        # Truncate very long transcripts to prevent API limits
        # Most LLM APIs have context limits
        max_length = 16000  # Adjust based on the model's context window
        truncated_transcript = request.transcript[:max_length]
        if len(request.transcript) > max_length:
            truncated_transcript += "\n[Transcript truncated due to length...]"
            
        summary = generate_bullet_summary(truncated_transcript)
        
        return {
            "success": True,
            "summary": summary
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating summary: {str(e)}")

def generate_quiz_questions(transcript, num_questions=5):
    """
    Generate multiple-choice quiz questions based on a transcript using Groq API
    """
    if not GROQ_API_KEY or not groq_client:
        # Return mock questions if Groq API is not available
        return [
            {
                "question": "What is the main topic of this mock transcript?",
                "options": [
                    "Artificial Intelligence",
                    "Machine Learning",
                    "Data Science",
                    "Mock Data"
                ],
                "correct_answer": 3
            },
            {
                "question": "This is a mock question because...",
                "options": [
                    "The GROQ_API_KEY is not set",
                    "The transcript is too short",
                    "The system is in testing mode",
                    "All of the above"
                ],
                "correct_answer": 0
            }
        ]
    
    try:
        # Define the prompt for generating quiz questions
        prompt = f"""
        Create a quiz with {num_questions} multiple-choice questions based on the following transcript.
        
        Requirements:
        - Generate exactly {num_questions} questions (or fewer if the transcript is very short)
        - Each question should have 4 options (A, B, C, D)
        - Only one option should be correct
        - Questions should test understanding of key concepts from the transcript
        - Questions should vary in difficulty (some easy, some moderate, some challenging)
        - Include the correct answer index (0-based, where 0 is the first option)
        
        Format your response as a JSON array of objects, with each object having:
        - "question": The question text
        - "options": An array of 4 possible answers
        - "correct_answer": The index (0-3) of the correct answer
        
        Example format:
        [
          {{
            "question": "What is the main topic discussed in the lecture?",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correct_answer": 2
          }},
          ...more questions...
        ]
        
        Important: Your entire response should be valid JSON that can be parsed. Do not include any explanatory text outside the JSON array.
        
        Transcript:
        {transcript}
        """
        
        # Call Groq API to generate the questions
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",  # Using newer Llama 3.3 70B model
            messages=[
                {"role": "system", "content": "You are a helpful assistant that creates educational quizzes. You always respond with valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.5,  # Slightly higher temperature for creative questions
            max_tokens=2048,
            response_format={"type": "json_object"}  # Ensure JSON response
        )
        
        # Extract the quiz from the response
        quiz_text = response.choices[0].message.content
        
        # Parse JSON
        import json
        try:
            quiz_data = json.loads(quiz_text)
            # If the JSON is wrapped in an object, extract the questions array
            if isinstance(quiz_data, dict) and "questions" in quiz_data:
                questions = quiz_data["questions"]
            # If it's directly an array
            elif isinstance(quiz_data, list):
                questions = quiz_data
            else:
                # Try to find any array in the response
                for key, value in quiz_data.items():
                    if isinstance(value, list) and len(value) > 0:
                        questions = value
                        break
                else:
                    # Fallback - couldn't find a valid array
                    raise ValueError("Could not extract questions array from response")
                
            # Validate and clean up questions
            validated_questions = []
            for q in questions:
                if "question" in q and "options" in q and "correct_answer" in q:
                    # Ensure correct_answer is an integer
                    if isinstance(q["correct_answer"], str) and q["correct_answer"].isdigit():
                        q["correct_answer"] = int(q["correct_answer"])
                    
                    # Ensure correct_answer is within valid range
                    if not isinstance(q["correct_answer"], int) or q["correct_answer"] < 0 or q["correct_answer"] >= len(q["options"]):
                        # Default to first option if invalid
                        q["correct_answer"] = 0
                        
                    validated_questions.append(q)
            
            return validated_questions
        except Exception as e:
            return [{"question": f"Error parsing quiz questions: {str(e)}",
                    "options": ["Error", "Try again", "Check logs", "Contact support"],
                    "correct_answer": 2}]
        
    except Exception as e:
        return [{"question": f"Error generating quiz: {str(e)}",
                "options": ["Error", "Try again", "Check API key", "Contact support"],
                "correct_answer": 2}]

# Define request and response models for the quiz endpoint
class QuizRequest(BaseModel):
    transcript: str
    num_questions: Optional[int] = 5

class QuizQuestion(BaseModel):
    question: str
    options: List[str]
    correct_answer: int

class QuizResponse(BaseModel):
    success: bool
    questions: List[QuizQuestion]

@app.post("/api/generate-quiz", response_model=QuizResponse)
async def generate_quiz_endpoint(request: QuizRequest):
    """
    Endpoint to generate a quiz with multiple-choice questions from a transcript
    """
    try:
        if not request.transcript:
            raise HTTPException(status_code=400, detail="Transcript is required")
            
        # Truncate very long transcripts to prevent API limits
        max_length = 16000  # Adjust based on the model's context window
        truncated_transcript = request.transcript[:max_length]
        if len(request.transcript) > max_length:
            truncated_transcript += "\n[Transcript truncated due to length...]"
            
        # Ensure num_questions is within reasonable limits
        num_questions = max(1, min(request.num_questions, 10))
        
        questions = generate_quiz_questions(truncated_transcript, num_questions)
        
        return {
            "success": True,
            "questions": questions
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating quiz: {str(e)}")

# Define the chat message model
class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str

# Define the chat request model
class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    transcript: str

# Define the chat response model
class ChatResponse(BaseModel):
    message: str
    
@app.post("/api/chat", response_model=ChatResponse)
async def chat_with_tutor(request: ChatRequest):
    """
    Endpoint to chat with an AI tutor about the transcript content
    """
    try:
        if not request.transcript:
            raise HTTPException(status_code=400, detail="Transcript is required")
        
        if not request.messages or len(request.messages) == 0:
            raise HTTPException(status_code=400, detail="At least one message is required")
        
        # Format messages for the LLM
        formatted_messages = [
            {"role": "system", "content": get_socratic_system_prompt()},
        ]
        
        # Add transcript context
        context_message = {
            "role": "system", 
            "content": f"The following is the transcript of a lecture that the student wants to discuss:\n\n{request.transcript[:8000]}"
        }
        formatted_messages.append(context_message)
        
        # Add conversation history
        for msg in request.messages:
            formatted_messages.append({"role": msg.role, "content": msg.content})
        
        # Generate response
        response = generate_socratic_response(formatted_messages)
        
        return {
            "message": response
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating response: {str(e)}")

def get_socratic_system_prompt():
    """
    Create the system prompt for the Socratic tutor
    """
    return """You are a Socratic tutor. Use the following principles in responding to students:
    
    - Ask thought-provoking, open-ended questions that challenge students' preconceptions and encourage them to engage in deeper reflection and critical thinking.
    - Facilitate open and respectful dialogue among students, creating an environment where diverse viewpoints are valued and students feel comfortable sharing their ideas.
    - Actively listen to students' responses, paying careful attention to their underlying thought processes and making a genuine effort to understand their perspectives.
    - Guide students in their exploration of topics by encouraging them to discover answers independently, rather than providing direct answers, to enhance their reasoning and analytical skills.
    - Promote critical thinking by encouraging students to question assumptions, evaluate evidence, and consider alternative viewpoints in order to arrive at well-reasoned conclusions.
    - Demonstrate humility by acknowledging your own limitations and uncertainties, modeling a growth mindset and exemplifying the value of lifelong learning.

    Base your responses on the following transcription content. Your goal is not to simply provide answers, but to help the student think critically about the material through Socratic questioning.

    Keep your responses concise (3-5 sentences maximum) unless elaboration is necessary to explain a complex concept.
    """

def generate_socratic_response(messages):
    """
    Generate a Socratic tutor response using the Groq API
    """
    if not GROQ_API_KEY or not groq_client:
        # Return mock response if Groq API is not available
        return "I'd be happy to discuss this lecture with you! What specific aspect would you like to explore further? Is there a concept you find particularly challenging or interesting? (Note: This is a mock response as the Groq API key is not configured)"
    
    try:
        # Call Groq API to generate the response
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",  # Using Llama 3.3 70B model
            messages=messages,
            temperature=0.7,  # Slightly higher temperature for more varied responses
            max_tokens=1024
        )
        
        # Extract the response text
        return response.choices[0].message.content
    except Exception as e:
        return f"I'm having trouble processing your question. Could you try asking in a different way? (Error: {str(e)})"

@app.post("/api/chat-stream")
async def chat_with_tutor_stream(request: ChatRequest):
    """
    Endpoint to chat with an AI tutor with streaming response
    """
    try:
        if not request.transcript:
            raise HTTPException(status_code=400, detail="Transcript is required")
        
        if not request.messages or len(request.messages) == 0:
            raise HTTPException(status_code=400, detail="At least one message is required")
        
        # Always use the Socratic tutor system prompt
        system_prompt = get_socratic_system_prompt()
        
        # Format messages for the LLM
        formatted_messages = [
            {"role": "system", "content": system_prompt},
        ]
        
        # Add transcript context
        context_message = {
            "role": "system", 
            "content": f"The following is the transcript of a lecture that the student wants to discuss:\n\n{request.transcript[:8000]}"
        }
        formatted_messages.append(context_message)
        
        # Add conversation history
        for msg in request.messages:
            formatted_messages.append({"role": msg.role, "content": msg.content})
        
        # Return streaming response
        return StreamingResponse(
            generate_streaming_response(formatted_messages),
            media_type="text/event-stream"
        )
    
    except Exception as e:
        error_json = json.dumps({"error": str(e)})
        async def error_stream():
            yield f"data: {error_json}\n\n"
        return StreamingResponse(error_stream(), media_type="text/event-stream")

async def generate_streaming_response(messages):
    """
    Generate a streaming response from the model - optimized version
    """
    if not GROQ_API_KEY or not groq_client:
        # Mock streaming for development without API key
        mock_response = "I'd be happy to discuss this lecture with you! What specific aspect would you like to explore further? Is there a concept you find particularly challenging or interesting? (Note: This is a mock response as the Groq API key is not configured)"
        
        # Stream by blocks for better performance
        blocks = mock_response.split('. ')
        for block in blocks:
            yield f"data: {json.dumps({'chunk': block + '. '})}\n\n"
            await asyncio.sleep(0.08)  # Slightly shorter delay
        
        yield f"data: {json.dumps({'done': True})}\n\n"
        return
    
    try:
        # Call Groq API with streaming enabled
        stream = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            temperature=0.7,
            max_tokens=1024,
            stream=True
        )
        
        # Buffer for more efficient sending
        buffer = ""
        last_send_time = time.time()
        
        # Stream the response chunks with optimized buffering
        for chunk in stream:
            content = chunk.choices[0].delta.content
            if content:
                buffer += content
                
                # Send in larger chunks or after a time threshold to reduce overhead
                current_time = time.time()
                should_send = (
                    len(buffer) >= 10 or  # Send if buffer has 10+ characters
                    '.' in buffer or      # Send if buffer contains sentence end
                    '\n' in buffer or     # Send if buffer contains newline
                    current_time - last_send_time > 0.2  # Send at least every 200ms
                )
                
                if should_send and buffer:
                    yield f"data: {json.dumps({'chunk': buffer})}\n\n"
                    buffer = ""
                    last_send_time = current_time
        
        # Send any remaining buffered content
        if buffer:
            yield f"data: {json.dumps({'chunk': buffer})}\n\n"
        
        # Signal completion
        yield f"data: {json.dumps({'done': True})}\n\n"
    
    except Exception as e:
        error_message = f"I'm having trouble processing your question. Could you try asking in a different way? (Error: {str(e)})"
        yield f"data: {json.dumps({'chunk': error_message})}\n\n"
        yield f"data: {json.dumps({'done': True})}\n\n"






