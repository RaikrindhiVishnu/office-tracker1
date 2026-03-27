import NotificationBell from "@/components/common/NotificationBell"
import { useAuth } from "@/context/AuthContext"

export default function Header() {
  const { user } = useAuth()

  return (
    <div className="flex justify-between items-center">
      <h2>Dashboard</h2>

      {/* Notification Bell */}
      {user && <NotificationBell userId={user.uid} />}
    </div>
  )
}