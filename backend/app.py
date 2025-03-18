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






