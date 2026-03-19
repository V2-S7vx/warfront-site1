exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json"
  };

  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: "Method not allowed" })
      };
    }

    let body = {};
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid JSON body" })
      };
    }

    const requiredFields = [
      "rp_name",
      "discord_username",
      "discord_user_id",
      "email",
      "age",
      "found_us",
      "group"
    ];

    for (const field of requiredFields) {
      if (!body[field] || String(body[field]).trim() === "") {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `Missing field: ${field}` })
        };
      }
    }

    const BOT_TOKEN = (
      process.env.DISCORD_BOT_TOKEN ||
      process.env.DISCORD_TOKEN ||
      ""
    ).trim();

    const GUILD_ID = (
      process.env.DISCORD_GUILD_ID ||
      process.env.GUILD_ID ||
      ""
    ).trim();

    const CHANNEL_ID = (
      process.env.DISCORD_CHANNEL_ID ||
      "1483624256909611078"
    ).trim();

    const PING_ROLE_ID = (
      process.env.DISCORD_REVIEW_ROLE_ID ||
      "1483595545548423289"
    ).trim();

    const DECLINED_ROLE_ID = (
      process.env.DISCORD_DECLINED_ROLE_ID ||
      "1483643776953090221"
    ).trim();

    const PENDING_ROLE_ID = (
      process.env.DISCORD_PENDING_APPLICATION_ROLE_ID ||
      "1484269890574487652"
    ).trim();

    if (!BOT_TOKEN) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: "Missing Discord token. Add DISCORD_BOT_TOKEN or DISCORD_TOKEN in Netlify environment variables."
        })
      };
    }

    if (!GUILD_ID) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: "Missing Discord guild ID. Add DISCORD_GUILD_ID or GUILD_ID in Netlify environment variables."
        })
      };
    }

    const userId = String(body.discord_user_id).trim();

    if (!/^\d{17,20}$/.test(userId)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "discord_user_id must be a valid Discord user ID"
        })
      };
    }

    const clean = (value, max = 1000) => {
      if (value === null || value === undefined) return "Not provided";

      const text = String(value).trim();
      if (!text) return "Not provided";

      return text
        .replace(/@everyone/g, "@ everyone")
        .replace(/@here/g, "@ here")
        .replace(/<@&?\d+>/g, "[mention removed]")
        .slice(0, max);
    };

    const discordHeaders = {
      Authorization: `Bot ${BOT_TOKEN}`,
      "Content-Type": "application/json"
    };

    const memberResponse = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${userId}`,
      {
        method: "GET",
        headers: discordHeaders
      }
    );

    if (memberResponse.status === 404) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "You must be in the Discord server before applying."
        })
      };
    }

    const memberText = await memberResponse.text();

    if (!memberResponse.ok) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: `Discord member lookup failed: ${memberResponse.status}`,
          details: memberText
        })
      };
    }

    let memberData = {};
    try {
      memberData = JSON.parse(memberText);
    } catch {
      memberData = {};
    }

    const memberRoles = Array.isArray(memberData.roles) ? memberData.roles : [];

    if (memberRoles.includes(DECLINED_ROLE_ID)) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          error: "You cannot reapply yet. Please wait until your 48 hour cooldown ends."
        })
      };
    }

    if (memberRoles.includes(PENDING_ROLE_ID)) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          error: "You already have an application pending. Please wait until it has been reviewed."
        })
      };
    }

    const roleAddResponse = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${userId}/roles/${PENDING_ROLE_ID}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bot ${BOT_TOKEN}`
        }
      }
    );

    if (!roleAddResponse.ok) {
      const roleAddText = await roleAddResponse.text();
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: "Failed to assign pending application role.",
          details: roleAddText
        })
      };
    }

    const embed = {
      title: "New Warfront 1941 Application",
      color: 11831862,
      fields: [
        { name: "RP Name", value: clean(body.rp_name), inline: true },
        { name: "Discord Username & ID", value: clean(body.discord_username), inline: true },
        { name: "Discord User ID", value: clean(body.discord_user_id), inline: true },
        { name: "Age", value: clean(body.age), inline: true },
        { name: "Email", value: clean(body.email), inline: true },
        { name: "Found Us Via", value: clean(body.found_us), inline: true },
        { name: "Group Applying For", value: clean(body.group), inline: true },
        { name: "Steam Profile", value: clean(body.steam_profile), inline: false },
        { name: "Previous Experience", value: clean(body.experience), inline: false },
        { name: "Why Join", value: clean(body.why_join), inline: false },
        { name: "About You", value: clean(body.about_you), inline: false },
        { name: "Community Knowledge", value: clean(body.community_knowledge), inline: false },
        { name: "Availability", value: clean(body.availability), inline: false }
      ],
      footer: {
        text: "Warfront 1941 Website Application"
      },
      timestamp: new Date().toISOString()
    };

    const components = [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 3,
            custom_id: `app_accept_${userId}`,
            label: "Accept"
          },
          {
            type: 2,
            style: 4,
            custom_id: `app_decline_${userId}`,
            label: "Decline"
          }
        ]
      }
    ];

    const discordResponse = await fetch(
      `https://discord.com/api/v10/channels/${CHANNEL_ID}/messages`,
      {
        method: "POST",
        headers: discordHeaders,
        body: JSON.stringify({
          content: `<@&${PING_ROLE_ID}> New application from <@${userId}>`,
          embeds: [embed],
          components,
          allowed_mentions: {
            roles: [PING_ROLE_ID],
            users: [userId]
          }
        })
      }
    );

    const discordText = await discordResponse.text();

    if (!discordResponse.ok) {
      await fetch(
        `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${userId}/roles/${PENDING_ROLE_ID}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bot ${BOT_TOKEN}`
          }
        }
      );

      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: `Discord API error: ${discordResponse.status}`,
          details: discordText
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        message: "ok"
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Server error",
        details: error.message
      })
    };
  }
};