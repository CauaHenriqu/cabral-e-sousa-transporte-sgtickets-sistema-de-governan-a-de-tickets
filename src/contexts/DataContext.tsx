import React, { createContext, useContext, useState } from 'react';

export interface Service {
  id: string;
  code: string;
  name: string;
  status: 'Ativo' | 'Inativo';
}

export interface Attendant {
  id: string;
  name: string;
  sector: string;
  function: string;
  email: string;
  phone: string;
  leaderName: string;
  createdAt: string;
  status: 'Ativo' | 'Inativo';
  firstLogin: boolean;
  password: string;
}

export interface UserRecord {
  id: string;
  name: string;
  sector: string;
  function: string;
  email: string;
  phone: string;
  leaderName: string;
  createdAt: string;
  status: 'Ativo' | 'Inativo';
  firstLogin: boolean;
  password: string;
}

export interface AdminRecord {
  id: string;
  name: string;
  sector: string;
  function: string;
  email: string;
  phone: string;
  leaderName: string;
  createdAt: string;
  status: 'Ativo' | 'Inativo';
  firstLogin: boolean;
}

export interface AttendantService {
  attendantId: string;
  serviceId: string;
}

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'number';
  required: boolean;
  options?: string[];
}

export interface ServiceForm {
  id: string;
  serviceId: string;
  name: string;
  fields: FormField[];
}

export interface TicketMessage {
  id: string;
  sender: string;
  senderRole: 'user' | 'attendant' | 'system';
  content: string;
  timestamp: string;
}

export interface TicketRating {
  score: number;
  reason?: string;
}

export interface Ticket {
  id: string;
  userId: string;
  userName: string;
  attendantId: string;
  attendantName: string;
  serviceId: string;
  serviceName: string;
  status: 'ABERTO' | 'FECHADO';
  reopened: boolean;
  messages: TicketMessage[];
  formData?: Record<string, string>;
  rating?: TicketRating;
  createdAt: string;
  closedAt?: string;
}

export interface WorkSchedule {
  attendantId: string;
  dayOfWeek: number; // 0=Sun, 1=Mon...6=Sat
  startTime: string;
  endTime: string;
}

interface DataContextType {
  services: Service[];
  setServices: React.Dispatch<React.SetStateAction<Service[]>>;
  attendants: Attendant[];
  setAttendants: React.Dispatch<React.SetStateAction<Attendant[]>>;
  users: UserRecord[];
  setUsers: React.Dispatch<React.SetStateAction<UserRecord[]>>;
  admins: AdminRecord[];
  setAdmins: React.Dispatch<React.SetStateAction<AdminRecord[]>>;
  attendantServices: AttendantService[];
  setAttendantServices: React.Dispatch<React.SetStateAction<AttendantService[]>>;
  serviceForms: ServiceForm[];
  setServiceForms: React.Dispatch<React.SetStateAction<ServiceForm[]>>;
  tickets: Ticket[];
  setTickets: React.Dispatch<React.SetStateAction<Ticket[]>>;
  workSchedules: WorkSchedule[];
  setWorkSchedules: React.Dispatch<React.SetStateAction<WorkSchedule[]>>;
}

const DataContext = createContext<DataContextType | null>(null);

const initialServices: Service[] = [
  { id: 's1', code: 'SUP-001', name: 'Suporte Técnico', status: 'Ativo' },
  { id: 's2', code: 'SUP-002', name: 'Reset de Senha', status: 'Ativo' },
  { id: 's3', code: 'SUP-003', name: 'Instalação de Software', status: 'Ativo' },
  { id: 's4', code: 'SUP-004', name: 'Acesso a Sistemas', status: 'Inativo' },
];

const initialAttendants: Attendant[] = [
  { id: 'a1', name: 'Carlos Oliveira', sector: 'Suporte', function: 'Atendente N1', email: 'carlos@sgtickets.com', phone: '(11) 99999-0003', leaderName: 'Ana Lima', createdAt: '2024-01-15T08:00:00', status: 'Ativo', firstLogin: false, password: 'atend123' },
  { id: 'a2', name: 'Fernanda Costa', sector: 'Suporte', function: 'Atendente N2', email: 'fernanda@sgtickets.com', phone: '(11) 99999-0004', leaderName: 'Ana Lima', createdAt: '2024-02-10T09:00:00', status: 'Ativo', firstLogin: false, password: 'atend123' },
  { id: 'a3', name: 'Rafael Santos', sector: 'Suporte', function: 'Atendente N1', email: 'rafael@sgtickets.com', phone: '(11) 99999-0005', leaderName: 'Ana Lima', createdAt: '2024-03-01T10:00:00', status: 'Ativo', firstLogin: false, password: 'atend123' },
];

const initialUsers: UserRecord[] = [
  { id: 'u1', name: 'Maria Silva', sector: 'Financeiro', function: 'Analista', email: 'maria@sgtickets.com', phone: '(11) 99999-0002', leaderName: 'João Souza', createdAt: '2024-01-10T08:00:00', status: 'Ativo', firstLogin: false, password: 'user123' },
  { id: 'u2', name: 'Pedro Almeida', sector: 'RH', function: 'Coordenador', email: 'pedro@sgtickets.com', phone: '(11) 99999-0006', leaderName: 'Clara Mendes', createdAt: '2024-02-20T09:00:00', status: 'Ativo', firstLogin: false, password: 'user123' },
];

const initialAdmins: AdminRecord[] = [
  { id: 'adm1', name: 'Admin Master', sector: 'TI', function: 'Administrador', email: 'admin@sgtickets.com', phone: '(11) 99999-0001', leaderName: '-', createdAt: '2024-01-01T00:00:00', status: 'Ativo', firstLogin: false },
];

const initialAttendantServices: AttendantService[] = [
  { attendantId: 'a1', serviceId: 's1' },
  { attendantId: 'a1', serviceId: 's2' },
  { attendantId: 'a2', serviceId: 's1' },
  { attendantId: 'a2', serviceId: 's3' },
  { attendantId: 'a3', serviceId: 's2' },
  { attendantId: 'a3', serviceId: 's3' },
];

const initialTickets: Ticket[] = [
  {
    id: 't1', userId: 'u1', userName: 'Maria Silva', attendantId: 'a1', attendantName: 'Carlos Oliveira',
    serviceId: 's1', serviceName: 'Suporte Técnico', status: 'FECHADO', reopened: false,
    messages: [
      { id: 'm1', sender: 'Maria Silva', senderRole: 'user', content: 'Meu computador não liga', timestamp: '2024-03-10T09:00:00' },
      { id: 'm2', sender: 'Carlos Oliveira', senderRole: 'attendant', content: 'Vou verificar. Pode confirmar o patrimônio?', timestamp: '2024-03-10T09:15:00' },
      { id: 'm3', sender: 'Maria Silva', senderRole: 'user', content: 'PAT-12345', timestamp: '2024-03-10T09:20:00' },
      { id: 'm4', sender: 'Carlos Oliveira', senderRole: 'attendant', content: 'Resolvido! Era a fonte de alimentação.', timestamp: '2024-03-10T14:00:00' },
    ],
    rating: { score: 5 },
    createdAt: '2024-03-10T09:00:00', closedAt: '2024-03-10T14:00:00',
  },
  {
    id: 't2', userId: 'u2', userName: 'Pedro Almeida', attendantId: 'a2', attendantName: 'Fernanda Costa',
    serviceId: 's3', serviceName: 'Instalação de Software', status: 'FECHADO', reopened: false,
    messages: [
      { id: 'm5', sender: 'Pedro Almeida', senderRole: 'user', content: 'Preciso do Office instalado', timestamp: '2024-03-11T10:00:00' },
      { id: 'm6', sender: 'Fernanda Costa', senderRole: 'attendant', content: 'Vou agendar a instalação para hoje à tarde.', timestamp: '2024-03-11T10:30:00' },
    ],
    rating: { score: 4 },
    createdAt: '2024-03-11T10:00:00', closedAt: '2024-03-12T15:00:00',
  },
  {
    id: 't3', userId: 'u1', userName: 'Maria Silva', attendantId: 'a1', attendantName: 'Carlos Oliveira',
    serviceId: 's2', serviceName: 'Reset de Senha', status: 'ABERTO', reopened: false,
    messages: [
      { id: 'm7', sender: 'Maria Silva', senderRole: 'user', content: 'Esqueci minha senha do ERP', timestamp: '2024-03-15T08:00:00' },
      { id: 'm8', sender: 'Carlos Oliveira', senderRole: 'attendant', content: 'Vou resetar agora.', timestamp: '2024-03-15T08:10:00' },
    ],
    createdAt: '2024-03-15T08:00:00',
  },
  {
    id: 't4', userId: 'u2', userName: 'Pedro Almeida', attendantId: 'a3', attendantName: 'Rafael Santos',
    serviceId: 's2', serviceName: 'Reset de Senha', status: 'FECHADO', reopened: true,
    messages: [
      { id: 'm9', sender: 'Pedro Almeida', senderRole: 'user', content: 'Senha do sistema de ponto', timestamp: '2024-03-12T14:00:00' },
      { id: 'm10', sender: 'Rafael Santos', senderRole: 'attendant', content: 'Resetado! Nova senha: temp123', timestamp: '2024-03-12T14:30:00' },
    ],
    rating: { score: 2, reason: 'Demorou muito para atender' },
    createdAt: '2024-03-12T14:00:00', closedAt: '2024-03-13T16:00:00',
  },
];

const initialWorkSchedules: WorkSchedule[] = [
  { attendantId: 'a1', dayOfWeek: 1, startTime: '08:00', endTime: '17:00' },
  { attendantId: 'a1', dayOfWeek: 2, startTime: '08:00', endTime: '17:00' },
  { attendantId: 'a1', dayOfWeek: 3, startTime: '08:00', endTime: '17:00' },
  { attendantId: 'a1', dayOfWeek: 4, startTime: '08:00', endTime: '17:00' },
  { attendantId: 'a1', dayOfWeek: 5, startTime: '08:00', endTime: '17:00' },
  { attendantId: 'a2', dayOfWeek: 1, startTime: '09:00', endTime: '18:00' },
  { attendantId: 'a2', dayOfWeek: 2, startTime: '09:00', endTime: '18:00' },
  { attendantId: 'a2', dayOfWeek: 3, startTime: '09:00', endTime: '18:00' },
  { attendantId: 'a2', dayOfWeek: 4, startTime: '09:00', endTime: '18:00' },
  { attendantId: 'a2', dayOfWeek: 5, startTime: '09:00', endTime: '18:00' },
  { attendantId: 'a3', dayOfWeek: 1, startTime: '08:00', endTime: '17:00' },
  { attendantId: 'a3', dayOfWeek: 2, startTime: '08:00', endTime: '17:00' },
  { attendantId: 'a3', dayOfWeek: 3, startTime: '08:00', endTime: '17:00' },
  { attendantId: 'a3', dayOfWeek: 4, startTime: '08:00', endTime: '17:00' },
  { attendantId: 'a3', dayOfWeek: 5, startTime: '08:00', endTime: '17:00' },
];

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [services, setServices] = useState<Service[]>(initialServices);
  const [attendants, setAttendants] = useState<Attendant[]>(initialAttendants);
  const [users, setUsers] = useState<UserRecord[]>(initialUsers);
  const [admins, setAdmins] = useState<AdminRecord[]>(initialAdmins);
  const [attendantServices, setAttendantServices] = useState<AttendantService[]>(initialAttendantServices);
  const [serviceForms, setServiceForms] = useState<ServiceForm[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [workSchedules, setWorkSchedules] = useState<WorkSchedule[]>(initialWorkSchedules);

  return (
    <DataContext.Provider value={{
      services, setServices,
      attendants, setAttendants,
      users, setUsers,
      admins, setAdmins,
      attendantServices, setAttendantServices,
      serviceForms, setServiceForms,
      tickets, setTickets,
      workSchedules, setWorkSchedules,
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
};
