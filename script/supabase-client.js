import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const supabase = createClient(
    "https://nnfvwpzwvscfpyrrsygt.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uZnZ3cHp3dnNjZnB5cnJzeWd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxNjgzMjIsImV4cCI6MjA4NTc0NDMyMn0.wqeKyvXjVKK8oo5CD09L8FvEH3H7rs2Xit-H4FG1HSc"
);