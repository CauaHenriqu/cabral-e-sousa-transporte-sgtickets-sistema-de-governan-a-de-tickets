import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import TicketDetailPanel, { TicketDetailPanelProps } from './TicketDetailPanel';

type TicketDetailModalProps = TicketDetailPanelProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const TicketDetailModal: React.FC<TicketDetailModalProps> = ({
  open,
  onOpenChange,
  ...panelProps
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="h-[90vh] w-[95vw] max-w-6xl overflow-hidden p-1 sm:w-[90vw]"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <TicketDetailPanel
          {...panelProps}
          className="h-full w-full"
          showCloseButton={false}
          showMaximizeButton={false}
          onClosePanel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
};

export default TicketDetailModal;
