using System;
using System.Web;
using System.Data;
using System.Data.SqlClient;
using System.Collections.Generic;
using System.Web.Script.Serialization;

public class TaskHandler : IHttpHandler, System.Web.SessionState.IRequiresSessionState
{
    string connStr = @"Data Source=(LocalDB)\MSSQLLocalDB;AttachDbFilename=D:\Setups\WebApplication1\WebApplication1\App_Data\Database1test.mdf;Integrated Security=True";

    public void ProcessRequest(HttpContext context)
    {
        context.Response.ContentType = "application/json";
        string action = context.Request.Form["action"];

        try
        {
            if (action == "signup") Signup(context);
            else if (action == "login") Login(context);
            else if (action == "initdb") InitializeDatabase(context);
            else if (action == "addtask") AddTask(context);
            else if (action == "gettasks") GetTasks(context);
            else if (action == "deletetask") DeleteTask(context);
            else if (action == "updatetask") UpdateTask(context);
        }
        catch (Exception ex)
        {
            context.Response.Write("{\"success\": false, \"message\": \"" + EscapeJsonString(ex.Message) + "\"}");
        }
    }

    private string EscapeJsonString(string str)
    {
        if (string.IsNullOrEmpty(str)) return str;
        return str.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\r", "\\r");
    }

    private void InitializeDatabase(HttpContext context)
    {
        using (SqlConnection conn = new SqlConnection(connStr))
        {
            conn.Open();

            // Create Users table if not exists
            string createUsers = @"IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users' AND xtype='U')
                CREATE TABLE Users (
                    Id INT IDENTITY(1,1) PRIMARY KEY,
                    Name NVARCHAR(255) NOT NULL,
                    Email NVARCHAR(255) NOT NULL UNIQUE,
                    Password NVARCHAR(255) NOT NULL
                )";
            new SqlCommand(createUsers, conn).ExecuteNonQuery();

            // Create Tasks table if not exists
            string createTasks = @"IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Tasks' AND xtype='U')
                CREATE TABLE Tasks (
                    Id INT IDENTITY(1,1) PRIMARY KEY,
                    Title NVARCHAR(255) NOT NULL,
                    Description NVARCHAR(MAX),
                    TaskDate DATE NOT NULL,
                    Priority NVARCHAR(50),
                    Status NVARCHAR(50) DEFAULT 'Pending',
                    UserEmail NVARCHAR(255)
                )";
            new SqlCommand(createTasks, conn).ExecuteNonQuery();

            // Add UserEmail column if missing
            string checkColumn = @"SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                                   WHERE TABLE_NAME = 'Tasks' AND COLUMN_NAME = 'UserEmail'";
            if ((int)new SqlCommand(checkColumn, conn).ExecuteScalar() == 0)
            {
                new SqlCommand("ALTER TABLE Tasks ADD UserEmail NVARCHAR(255)", conn).ExecuteNonQuery();
            }

            // Add Status column if missing
            string checkStatus = @"SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                                   WHERE TABLE_NAME = 'Tasks' AND COLUMN_NAME = 'Status'";
            if ((int)new SqlCommand(checkStatus, conn).ExecuteScalar() == 0)
            {
                new SqlCommand("ALTER TABLE Tasks ADD Status NVARCHAR(50) DEFAULT 'Pending'", conn).ExecuteNonQuery();
            }

            context.Response.Write("{\"success\": true, \"message\": \"Database initialized\"}");
        }
    }

    private void Signup(HttpContext context)
    {
        using (SqlConnection conn = new SqlConnection(connStr))
        {
            conn.Open();
            
            string checkSql = "SELECT COUNT(*) FROM Users WHERE Email=@email";
            SqlCommand checkCmd = new SqlCommand(checkSql, conn);
            checkCmd.Parameters.AddWithValue("@email", context.Request.Form["email"]);
            int count = (int)checkCmd.ExecuteScalar();

            if (count > 0)
            {
                context.Response.Write("{\"success\": false, \"message\": \"Email already registered\"}");
                return;
            }

            string sql = "INSERT INTO Users (Name, Email, Password) VALUES (@name, @email, @pass)";
            SqlCommand cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@name", context.Request.Form["name"]);
            cmd.Parameters.AddWithValue("@email", context.Request.Form["email"]);
            cmd.Parameters.AddWithValue("@pass", context.Request.Form["password"]);
            cmd.ExecuteNonQuery();
            context.Response.Write("{\"success\": true}");
        }
    }

    private void Login(HttpContext context)
    {
        using (SqlConnection conn = new SqlConnection(connStr))
        {
            string sql = "SELECT Name FROM Users WHERE Email=@e AND Password=@p";
            SqlCommand cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@e", context.Request.Form["email"]);
            cmd.Parameters.AddWithValue("@p", context.Request.Form["password"]);
            conn.Open();
            object result = cmd.ExecuteScalar();

            if (result != null)
            {
                context.Session["UserEmail"] = context.Request.Form["email"];
                context.Response.Write("{\"success\": true, \"name\": \"" + EscapeJsonString(result.ToString()) + "\"}");
            }
            else
            {
                context.Response.Write("{\"success\": false}");
            }
        }
    }

    private void AddTask(HttpContext context)
    {
        string userEmail = context.Session["UserEmail"] as string;
        if (string.IsNullOrEmpty(userEmail))
        {
            context.Response.Write("{\"success\": false, \"message\": \"Please login first\"}");
            return;
        }

        using (SqlConnection conn = new SqlConnection(connStr))
        {
            string sql = "INSERT INTO Tasks (Title, Description, TaskDate, Priority, UserEmail, Status) VALUES (@t, @d, @dt, @p, @email, @s)";
            SqlCommand cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@t", context.Request.Form["title"]);
            cmd.Parameters.AddWithValue("@d", context.Request.Form["desc"] ?? "");
            cmd.Parameters.AddWithValue("@dt", context.Request.Form["date"]);
            cmd.Parameters.AddWithValue("@p", context.Request.Form["priority"]);
            cmd.Parameters.AddWithValue("@email", userEmail);
            cmd.Parameters.AddWithValue("@s", context.Request.Form["status"] ?? "Pending");
            conn.Open();
            cmd.ExecuteNonQuery();
            context.Response.Write("{\"success\": true}");
        }
    }

    private void GetTasks(HttpContext context)
    {
        string userEmail = context.Session["UserEmail"] as string;
        if (string.IsNullOrEmpty(userEmail))
        {
            context.Response.Write("{\"success\": false, \"message\": \"Please login first\"}");
            return;
        }

        List<object> tasks = new List<object>();
        using (SqlConnection conn = new SqlConnection(connStr))
        {
            string sql = "SELECT Title, Description, TaskDate, Priority, Status FROM Tasks WHERE UserEmail=@email ORDER BY TaskDate";
            SqlCommand cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@email", userEmail);
            conn.Open();
            SqlDataReader rdr = cmd.ExecuteReader();
            while (rdr.Read())
            {
                tasks.Add(new
                {
                    title = rdr["Title"],
                    desc = rdr["Description"],
                    date = Convert.ToDateTime(rdr["TaskDate"]).ToString("yyyy-MM-dd"),
                    priority = rdr["Priority"],
                    status = rdr["Status"] != DBNull.Value ? rdr["Status"].ToString() : "Pending"
                });
            }
        }
        context.Response.Write(new JavaScriptSerializer().Serialize(new { success = true, tasks }));
    }

    private void UpdateTask(HttpContext context)
    {
        string userEmail = context.Session["UserEmail"] as string;
        if (string.IsNullOrEmpty(userEmail))
        {
            context.Response.Write("{\"success\": false, \"message\": \"Please login first\"}");
            return;
        }

        using (SqlConnection conn = new SqlConnection(connStr))
        {
            string sql = "UPDATE Tasks SET Title=@t, Description=@d, TaskDate=@dt, Priority=@p, Status=@s WHERE Title=@oldT AND UserEmail=@email";
            SqlCommand cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@t", context.Request.Form["title"]);
            cmd.Parameters.AddWithValue("@d", context.Request.Form["desc"] ?? "");
            cmd.Parameters.AddWithValue("@dt", context.Request.Form["date"]);
            cmd.Parameters.AddWithValue("@p", context.Request.Form["priority"]);
            cmd.Parameters.AddWithValue("@s", context.Request.Form["status"] ?? "Pending");
            cmd.Parameters.AddWithValue("@oldT", context.Request.Form["oldTitle"]);
            cmd.Parameters.AddWithValue("@email", userEmail);
            conn.Open();
            cmd.ExecuteNonQuery();
            context.Response.Write("{\"success\": true}");
        }
    }

    private void DeleteTask(HttpContext context)
    {
        string userEmail = context.Session["UserEmail"] as string;
        if (string.IsNullOrEmpty(userEmail))
        {
            context.Response.Write("{\"success\": false, \"message\": \"Please login first\"}");
            return;
        }

        using (SqlConnection conn = new SqlConnection(connStr))
        {
            string sql = "DELETE FROM Tasks WHERE Title=@title AND UserEmail=@email";
            SqlCommand cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@title", context.Request.Form["title"]);
            cmd.Parameters.AddWithValue("@email", userEmail);
            conn.Open();
            cmd.ExecuteNonQuery();
            context.Response.Write("{\"success\": true}");
        }
    }

    public bool IsReusable { get { return false; } }
}