import { useSocket as useSocketFromContext } from '../context/SocketContext';

export const useSocket = () => {
  return useSocketFromContext();
};

export default useSocket;
