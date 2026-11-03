import type { Lang } from './types';

export const LANGS: { code: Lang; label: string; speech: string }[] = [
  { code: 'hi', label: 'हिं', speech: 'hi-IN' },
  { code: 'mr', label: 'मरा', speech: 'mr-IN' },
  { code: 'en', label: 'EN', speech: 'en-IN' },
];

type Key =
  | 'hello' | 'trips' | 'no_trips' | 'tap_photo' | 'hold_steady' | 'gps_wait' | 'preparing' | 'sending'
  | 'saved_offline' | 'accepted' | 'retake_title' | 'review_title' | 'review_body' | 'retakes_left' | 'take_again'
  | 'back' | 'waiting_send' | 'rejected' | 'accepted_body' | 'done_close' | 'on_the_road' | 'ask_retake'
  | 'r_quality_blurry' | 'r_quality_dark' | 'r_quality_cropped' | 'r_stamp_missing' | 'r_signature_missing'
  | 'r_lr_missing' | 'r_lr_mismatch' | 'r_date_missing' | 'sync_now';

export const T: Record<Lang, Record<Key, string>> = {
  hi: {
    hello: 'नमस्ते', trips: 'आपकी गाड़ियाँ', no_trips: 'अभी कोई ट्रिप नहीं है',
    tap_photo: 'POD की फोटो लेने के लिए बड़ा बटन दबाइए', hold_steady: 'कागज़ पूरा दिखाइए। फोन स्थिर रखिए।',
    gps_wait: 'लोकेशन ली जा रही है', preparing: 'फोटो तैयार हो रही है', sending: 'फोटो भेजी जा रही है',
    saved_offline: 'नेटवर्क नहीं है। फोटो फोन में सुरक्षित है। नेटवर्क आते ही अपने आप चली जाएगी।',
    accepted: 'बहुत बढ़िया। POD मिल गया।', accepted_body: 'आपका काम पूरा हुआ।',
    retake_title: 'फोटो दोबारा लीजिए', review_title: 'फोटो दफ़्तर को भेज दी गई',
    review_body: 'दफ़्तर जाँच करेगा। आपको कुछ और नहीं करना है।', retakes_left: 'बाकी मौके',
    take_again: 'दोबारा फोटो लें', back: 'वापस', waiting_send: 'भेजने के लिए रुकी फोटो', rejected: 'फोटो स्वीकार नहीं हुई',
    done_close: 'अब आप यह पेज बंद कर सकते हैं।', on_the_road: 'रास्ते में', ask_retake: 'दोबारा फोटो चाहिए',
    r_quality_blurry: 'फोटो धुंधली है। फोन स्थिर रखिए।', r_quality_dark: 'फोटो अंधेरी है। रोशनी में लीजिए।',
    r_quality_cropped: 'कागज़ पूरा दिखाइए।', r_stamp_missing: 'मोहर साफ़ दिखाइए।', r_signature_missing: 'दस्तख़त साफ़ दिखाइए।',
    r_lr_missing: 'LR नंबर साफ़ दिखाइए।', r_lr_mismatch: 'सही LR कागज़ की फोटो लीजिए।', r_date_missing: 'तारीख़ साफ़ दिखाइए।', sync_now: 'अभी भेजें',
  },
  mr: {
    hello: 'नमस्कार', trips: 'तुमच्या गाड्या', no_trips: 'सध्या कोणतीही ट्रिप नाही',
    tap_photo: 'POD चा फोटो घेण्यासाठी मोठे बटन दाबा', hold_steady: 'पूर्ण कागद दिसू द्या. फोन स्थिर धरा.',
    gps_wait: 'लोकेशन घेत आहे', preparing: 'फोटो तयार होत आहे', sending: 'फोटो पाठवत आहे',
    saved_offline: 'नेटवर्क नाही. फोटो फोनमध्ये सुरक्षित आहे. नेटवर्क येताच आपोआप पाठवला जाईल.',
    accepted: 'छान! POD मिळाले.', accepted_body: 'तुमचे काम पूर्ण झाले.',
    retake_title: 'फोटो पुन्हा घ्या', review_title: 'फोटो ऑफिसला पाठवला',
    review_body: 'ऑफिस तपासणी करेल. तुम्हाला काही करायचे नाही.', retakes_left: 'उरलेल्या संधी',
    take_again: 'पुन्हा फोटो घ्या', back: 'मागे', waiting_send: 'पाठवण्यासाठी थांबलेले फोटो', rejected: 'फोटो स्वीकारला गेला नाही',
    done_close: 'आता तुम्ही हे पान बंद करू शकता.', on_the_road: 'रस्त्यात', ask_retake: 'पुन्हा फोटो हवा',
    r_quality_blurry: 'फोटो धूसर आहे. फोन स्थिर धरा.', r_quality_dark: 'फोटो अंधारा आहे. उजेडात घ्या.',
    r_quality_cropped: 'पूर्ण कागद दिसू द्या.', r_stamp_missing: 'शिक्का स्पष्ट दिसू द्या.', r_signature_missing: 'सही स्पष्ट दिसू द्या.',
    r_lr_missing: 'LR नंबर स्पष्ट दिसू द्या.', r_lr_mismatch: 'बरोबर LR कागदाचा फोटो घ्या.', r_date_missing: 'तारीख स्पष्ट दिसू द्या.', sync_now: 'आता पाठवा',
  },
  en: {
    hello: 'Hello', trips: 'Your trips', no_trips: 'No trips right now',
    tap_photo: 'Press the big button to photograph the POD', hold_steady: 'Show the whole paper. Hold the phone steady.',
    gps_wait: 'Getting location', preparing: 'Preparing photo', sending: 'Sending photo',
    saved_offline: 'No signal. The photo is safe on your phone and will send by itself when signal returns.',
    accepted: 'Well done. POD received.', accepted_body: 'Your job is done.',
    retake_title: 'Please take the photo again', review_title: 'Photo sent to the office',
    review_body: 'The office will check it. You do not need to do anything.', retakes_left: 'Tries left',
    take_again: 'Take photo again', back: 'Back', waiting_send: 'photo waiting to send', rejected: 'Photo not accepted',
    done_close: 'You can close this page now.', on_the_road: 'On the road', ask_retake: 'Retake needed',
    r_quality_blurry: 'Photo is blurry. Hold the phone steady.', r_quality_dark: 'Photo is dark. Take it in the light.',
    r_quality_cropped: 'Show the whole paper.', r_stamp_missing: 'Show the stamp clearly.', r_signature_missing: 'Show the signature clearly.',
    r_lr_missing: 'Show the LR number clearly.', r_lr_mismatch: 'Photograph the correct LR paper.', r_date_missing: 'Show the date clearly.', sync_now: 'Send now',
  },
};

export const speechLang = (l: Lang) => LANGS.find((x) => x.code === l)!.speech;

/** Speak a prompt using the phone's own voices. If no voice exists for the language, icons still carry the meaning. */
export function speak(text: string, lang: Lang) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = speechLang(lang);
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  } catch { /* silent */ }
}
