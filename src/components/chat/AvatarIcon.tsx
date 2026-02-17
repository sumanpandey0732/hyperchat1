import { getAvatarGradient, type User } from '@/lib/chat-data';

interface AvatarIconProps {
  user: User;
  index: number;
  size?: 'sm' | 'md' | 'lg';
  showStatus?: boolean;
}

const sizeMap = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-14 h-14 text-lg' };
const statusSizeMap = { sm: 'w-2.5 h-2.5', md: 'w-3 h-3', lg: 'w-3.5 h-3.5' };

const AvatarIcon = ({ user, index, size = 'md', showStatus = true }: AvatarIconProps) => {
  const initials = user.name.split(' ').map(n => n[0]).join('').slice(0, 2);

  return (
    <div className="relative flex-shrink-0">
      <div
        className={`${sizeMap[size]} rounded-full flex items-center justify-center font-semibold text-foreground select-none`}
        style={{ background: getAvatarGradient(index) }}
      >
        {initials}
      </div>
      {showStatus && (
        <div
          className={`absolute -bottom-0.5 -right-0.5 ${statusSizeMap[size]} rounded-full border-2 border-background ${
            user.status === 'online' ? 'status-online' : user.status === 'away' ? 'bg-warning' : 'status-offline'
          }`}
        />
      )}
    </div>
  );
};

export default AvatarIcon;
