'use client';

import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Share2 } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ChatInterface } from '@/components/chat/chat-interface';

interface PersonaData {
  id: string;
  name: string;
  description: string;
  avatar: string;
  model: string;
  instruction: string;
  temperature: number;
  tone: string;
  dos: string[];
  files: string[];
}

export default function PersonaChatPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const [persona, setPersona] = useState<PersonaData | null>(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareEmail, setShareEmail] = useState('');

  useEffect(() => {
    // Load persona data from sessionStorage
    const savedPersonas = sessionStorage.getItem('userPersonas');
    if (savedPersonas) {
      const personas = JSON.parse(savedPersonas);
      const currentPersona = personas.find((p: PersonaData) => p.id === params.id);
      if (currentPersona) {
        setPersona(currentPersona);
      }
    }
  }, [params.id]);

  if (!persona) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Loading persona...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-3 sm:p-4 md:p-6 lg:p-8 xl:p-12">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-3 sm:mb-4 max-w-[1072px] mx-auto px-2 sm:px-0">
        {/* Back to Edit Button */}
        <Button
          onClick={() => router.push(`/personas/new/configure?id=${params.id}`)}
          className="flex items-center justify-center font-medium text-xs sm:text-sm"
          style={{
            minWidth: 'auto',
            width: 'auto',
            height: '36px',
            minHeight: '36px',
            borderRadius: '8px',
            paddingTop: '7.5px',
            paddingRight: '8px',
            paddingBottom: '7.5px',
            paddingLeft: '8px',
            gap: '6px',
            backgroundColor: '#000000',
            color: '#FFFFFF'
          }}
        >
          <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span className="hidden xs:inline">Back to Edit</span>
          <span className="xs:hidden">Back</span>
        </Button>

        {/* Share Button */}
        <Button
          onClick={() => setShowShareDialog(true)}
          className="flex items-center justify-center font-medium border-black text-xs sm:text-sm"
          style={{
            minWidth: 'auto',
            width: 'auto',
            height: '36px',
            minHeight: '36px',
            borderRadius: '8px',
            paddingTop: '7.5px',
            paddingRight: '8px',
            paddingBottom: '7.5px',
            paddingLeft: '8px',
            gap: '6px',
            borderWidth: '1px',
            backgroundColor: '#FFFFFF',
            color: '#000000'
          }}
        >
          <Share2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span>Share</span>
        </Button>
      </div>

      {/* Chat Container */}
      <div 
        className="mx-auto overflow-hidden"
        style={{
          width: '100%',
          maxWidth: '1072px',
          height: 'calc(100vh - 100px)',
          borderRadius: '20px',
          padding: '8px',
          borderWidth: '1px',
          borderColor: '#E5E5E5',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <style jsx>{`
          @media (min-width: 640px) {
            div {
              height: calc(100vh - 110px);
              max-height: 793px;
              border-radius: 25px;
              padding: 10px;
            }
          }
          @media (min-width: 768px) {
            div {
              border-radius: 30px;
              padding: 12px;
            }
          }
        `}</style>
        <ChatInterface
          hidePersonaButton={true}
          hideAttachButton={true}
        />
      </div>

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent 
          className="border-none p-2 gap-3"
          style={{ 
            width: '420px',
            maxWidth: '420px',
            borderRadius: '10px',
            padding: '8px'
          }}
        >
          <div 
            className="flex flex-col"
            style={{
              width: '404px',
              gap: '12px'
            }}
          >
            {/* Title with close button */}
            <div className="flex items-center justify-between">
              <h3 
                style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: '#0A0A0A'
                }}
              >
                Share "{persona.name}"
              </h3>
              <button
                onClick={() => setShowShareDialog(false)}
                style={{
                  width: '16px',
                  height: '16px',
                  padding: 0,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M12 4L4 12M4 4L12 12" stroke="#666666" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            
            {/* Email Input */}
            <Input
              type="email"
              placeholder="Enter email for adding people"
              value={shareEmail}
              onChange={(e) => setShareEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && shareEmail.trim()) {
                  toast({
                    title: "User added",
                    description: `Invitation sent to ${shareEmail}`,
                  });
                  setShareEmail("");
                }
              }}
              style={{
                width: '404px',
                height: '36px',
                minHeight: '36px',
                borderRadius: '8px',
                paddingTop: '7.5px',
                paddingRight: '12px',
                paddingBottom: '7.5px',
                paddingLeft: '12px',
                borderWidth: '1px',
                color: '#000000'
              }}
              className="border-[#E5E5E5]"
            />
            
            {/* User List */}
            <div 
              className="flex flex-col gap-3"
              style={{
                width: '404px',
                height: '196px',
                overflowY: 'auto'
              }}
            >
              {/* Mock user - Owner */}
              <div 
                className="flex items-center justify-between"
                style={{
                  width: '404px',
                  height: '40px',
                  paddingRight: '8px',
                  paddingLeft: '8px'
                }}
              >
                <div className="flex items-center gap-2">
                  <div 
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: '#F5F5F5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden'
                    }}
                  >
                    <img
                      src={persona.avatar || '/icons/personas/persona1.png'}
                      alt="User"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                    />
                  </div>
                  <div className="flex flex-col">
                    <span 
                      style={{
                        fontWeight: 600,
                        fontSize: '12px',
                        lineHeight: '140%',
                        textTransform: 'capitalize',
                        color: '#0A0A0A'
                      }}
                    >
                      You
                    </span>
                    <span 
                      style={{
                        fontSize: '11px',
                        color: '#666666'
                      }}
                    >
                      your@email.com
                    </span>
                  </div>
                </div>
                <div 
                  style={{
                    width: '86px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '4px',
                    backgroundColor: '#FBEEB1',
                    fontSize: '11px',
                    fontWeight: 500,
                    color: '#B47800'
                  }}
                >
                  Owner
                </div>
              </div>

              {/* Mock shared users */}
              {[0, 1, 2].map((i) => (
                <div 
                  key={i}
                  className="flex items-center justify-between"
                  style={{
                    width: '404px',
                    height: '40px',
                    paddingRight: '8px',
                    paddingLeft: '8px'
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div 
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: '#F5F5F5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <span style={{ fontSize: '14px', color: '#666666' }}>
                        {String.fromCharCode(65 + i)}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span 
                        style={{
                          fontWeight: 600,
                          fontSize: '12px',
                          lineHeight: '140%',
                          textTransform: 'capitalize',
                          color: '#0A0A0A'
                        }}
                      >
                        Team Member {i}
                      </span>
                      <span 
                        style={{
                          fontSize: '11px',
                          color: '#666666'
                        }}
                      >
                        member{i}@team.com
                      </span>
                    </div>
                  </div>
                  <div 
                    style={{
                      width: '86px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '4px',
                      backgroundColor: '#EEF2FF',
                      fontSize: '11px',
                      fontWeight: 500,
                      color: '#4F46E7'
                    }}
                  >
                    Shared
                  </div>
                </div>
              ))}
            </div>
            
            {/* Action buttons */}
            <div className="flex gap-2 justify-end" style={{ padding: '12px 0' }}>
              <Button
                variant="ghost"
                onClick={() => setShowShareDialog(false)}
                style={{
                  fontSize: '14px',
                  color: '#666666',
                  padding: '8px 16px'
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (shareEmail.trim()) {
                    toast({
                      title: "User added",
                      description: `Invitation sent to ${shareEmail}`,
                    });
                    setShareEmail("");
                  }
                }}
                style={{
                  width: '51px',
                  height: '32px',
                  borderRadius: '8px',
                  padding: '5.5px 3px',
                  backgroundColor: '#000000',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: 500
                }}
              >
                Add
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
