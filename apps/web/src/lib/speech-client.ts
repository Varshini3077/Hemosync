import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";

/**
 * Initialises an Azure Speech SDK recogniser and starts continuous recognition.
 * Returns a stop function that the caller can invoke to halt recognition.
 */
export function startRecognition(
  onResult: (text: string) => void,
  onError: (err: string) => void,
): () => void {
  const speechKey = import.meta.env["VITE_AZURE_SPEECH_KEY"];
  const speechRegion = import.meta.env["VITE_AZURE_SPEECH_REGION"];

  if (!speechKey || !speechRegion) {
    onError("Azure Speech SDK credentials are not configured.");
    return () => undefined;
  }

  const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
    speechKey,
    speechRegion,
  );
  speechConfig.speechRecognitionLanguage = "en-US";

  const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
  const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

  recognizer.recognizing = (_sender, event) => {
    if (event.result.reason === SpeechSDK.ResultReason.RecognizingSpeech) {
      onResult(event.result.text);
    }
  };

  recognizer.recognized = (_sender, event) => {
    if (
      event.result.reason === SpeechSDK.ResultReason.RecognizedSpeech &&
      event.result.text.trim().length > 0
    ) {
      onResult(event.result.text);
    }
  };

  recognizer.canceled = (_sender, event) => {
    if (event.reason === SpeechSDK.CancellationReason.Error) {
      onError(`Speech recognition error: ${event.errorDetails}`);
    }
    recognizer.stopContinuousRecognitionAsync();
  };

  recognizer.startContinuousRecognitionAsync(
    () => undefined,
    (err) => {
      onError(`Failed to start recognition: ${String(err)}`);
    },
  );

  return () => {
    recognizer.stopContinuousRecognitionAsync(
      () => {
        recognizer.close();
      },
      (err) => {
        onError(`Failed to stop recognition: ${String(err)}`);
        recognizer.close();
      },
    );
  };
}
