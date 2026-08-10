/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as ticketCreated } from './ticket-created.tsx'
import { template as ticketClosed } from './ticket-closed.tsx'
import { template as ticketTransferred } from './ticket-transferred.tsx'
import { template as ticketRated } from './ticket-rated.tsx'
import { template as ticketMessage } from './ticket-message.tsx'
import { template as financeiroPendencia } from './financeiro-pendencia.tsx'
import { template as userWelcome } from './user-welcome.tsx'
import { template as approvalRequested } from './approval-requested.tsx'
import { template as approvalPendingInfo } from './approval-pending-info.tsx'
import { template as approvalApproved } from './approval-approved.tsx'
import { template as approvalRejected } from './approval-rejected.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'ticket-created': ticketCreated,
  'ticket-closed': ticketClosed,
  'ticket-transferred': ticketTransferred,
  'ticket-rated': ticketRated,
  'ticket-message': ticketMessage,
  'financeiro-pendencia': financeiroPendencia,
  'user-welcome': userWelcome,
  'approval-requested': approvalRequested,
  'approval-pending-info': approvalPendingInfo,
  'approval-approved': approvalApproved,
  'approval-rejected': approvalRejected,
}
