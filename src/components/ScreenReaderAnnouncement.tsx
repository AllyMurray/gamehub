import './ScreenReaderAnnouncement.css';

interface ScreenReaderAnnouncementProps {
  message: string;
  priority?: 'polite' | 'assertive';
}

/**
 * Component that announces messages to screen readers using ARIA live regions.
 * Screen readers will announce when the content changes.
 */
const ScreenReaderAnnouncement = ({
  message,
  priority = 'polite',
}: ScreenReaderAnnouncementProps) => {
  return (
    <div
      role="status"
      aria-live={priority}
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
};

export default ScreenReaderAnnouncement;
