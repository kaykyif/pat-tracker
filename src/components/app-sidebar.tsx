import { LayoutDashboard, FilePlus2, History, Settings, Moon, Sun, BarChart3, Database, ClipboardCheck } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";

const mainItems = [
  { title: "Backlog Comparativo", url: "/", icon: LayoutDashboard },
  { title: "Quadro Diretoria", url: "/quadro", icon: BarChart3 },
  { title: "Novo Upload", url: "/nova-analise", icon: FilePlus2 },
];

const reportItems = [
  { title: "Histórico", url: "/historico", icon: History },
  { title: "PATs - Info Gerais", url: "/pats", icon: Database },
];

const sysItems = [
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

export function AppSidebar() {
  const { pathname } = useLocation();
  const { theme, toggle } = useTheme();

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border/50 py-4">
        <div className="flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-sm">
            <ClipboardCheck className="h-6 w-6" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-bold text-sidebar-foreground tracking-wide">PAT Tracker</span>
            <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">Gestão de chamados</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="gap-0 py-2">
        <SidebarGroup>
          <div className="px-3 py-2 text-xs font-medium text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden">Principal</div>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((it) => (
                <SidebarMenuItem key={it.url}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={pathname === it.url} 
                    tooltip={it.title}
                    className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:font-medium transition-colors hover:bg-sidebar-accent hover:text-white"
                  >
                    <NavLink to={it.url}>
                      <it.icon />
                      <span>{it.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        <SidebarGroup>
          <div className="px-3 py-2 text-xs font-medium text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden mt-2">Relatórios</div>
          <SidebarGroupContent>
            <SidebarMenu>
              {reportItems.map((it) => (
                <SidebarMenuItem key={it.url}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={pathname === it.url} 
                    tooltip={it.title}
                    className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:font-medium transition-colors hover:bg-sidebar-accent hover:text-white"
                  >
                    <NavLink to={it.url}>
                      <it.icon />
                      <span>{it.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <div className="px-3 py-2 text-xs font-medium text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden mt-2">Sistema</div>
          <SidebarGroupContent>
            <SidebarMenu>
              {sysItems.map((it) => (
                <SidebarMenuItem key={it.url}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={pathname === it.url} 
                    tooltip={it.title}
                    className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:font-medium transition-colors hover:bg-sidebar-accent hover:text-white"
                  >
                    <NavLink to={it.url}>
                      <it.icon />
                      <span>{it.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="border-t border-sidebar-border/50 p-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between group-data-[collapsible=icon]:justify-center">
            <span className="text-xs text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden font-medium">Alternar Tema</span>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent hover:text-white shrink-0" onClick={toggle}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex flex-col items-center justify-center p-4">
            <span className="text-[10px] text-sidebar-foreground/40 text-center">v1.0.14</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}