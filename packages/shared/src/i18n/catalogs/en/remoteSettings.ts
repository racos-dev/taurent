export const englishRemoteSettings = {
  'common': {
    'unlimited': 'Unlimited',
    'zeroUnlimited': '0 = unlimited',
    'revert': 'Revert'
  },
  'sections': {
    'downloads': {
      'title': 'Downloads',
      'description': 'Torrent adding, save paths, and file handling.',
      'groups': {
        'adding': {
          'title': 'When Adding a Torrent'
        },
        'duplicate': {
          'title': 'When Duplicate Torrent Is Being Added'
        },
        'disk': {
          'title': 'Disk'
        },
        'saving': {
          'title': 'Saving Management'
        },
        'paths': {
          'title': 'Save Paths'
        },
        'copy': {
          'title': 'Copy .torrent Files'
        },
        'excluded': {
          'title': 'Excluded File Names'
        },
        'email': {
          'title': 'Email Notification'
        },
        'autorun': {
          'title': 'Run External Program'
        }
      }
    },
    'connection': {
      'title': 'Connection',
      'description': 'Listening port, connection limits, proxy, and IP filtering.',
      'groups': {
        'protocol': {
          'title': 'Peer Connection Protocol'
        },
        'port': {
          'title': 'Listening Port'
        },
        'limits': {
          'title': 'Connection Limits'
        },
        'i2p': {
          'title': 'I2P (Experimental)'
        },
        'proxy': {
          'title': 'Proxy Server'
        },
        'ipfilter': {
          'title': 'IP Filtering'
        }
      }
    },
    'speed': {
      'title': 'Speed',
      'description': 'Global and alternative rate limits, scheduling.',
      'groups': {
        'global': {
          'title': 'Global Rate Limits'
        },
        'alt': {
          'title': 'Alternative Rate Limits'
        },
        'schedule': {
          'title': 'Schedule'
        },
        'rate-settings': {
          'title': 'Rate Limit Settings'
        }
      }
    },
    'bittorrent': {
      'title': 'BitTorrent',
      'description': 'Privacy, encryption, queueing, seeding limits, and trackers.',
      'groups': {
        'privacy': {
          'title': 'Privacy'
        },
        'checking': {
          'title': 'Torrent Checking'
        },
        'queueing': {
          'title': 'Torrent Queueing'
        },
        'slow': {
          'title': 'Do Not Count Slow Torrents'
        },
        'seeding': {
          'title': 'Seeding Limits'
        },
        'trackers': {
          'title': 'Automatically Add Trackers'
        }
      }
    },
    'webui': {
      'title': 'WebUI',
      'description': 'Remote access, authentication, security, and reverse proxy.',
      'groups': {
        'webui-base': {
          'title': 'Web User Interface (Remote control)'
        },
        'https': {
          'title': 'HTTPS'
        },
        'auth': {
          'title': 'Authentication'
        },
        'security': {
          'title': 'Security'
        },
        'headers': {
          'title': 'Custom HTTP Headers'
        },
        'reverse-proxy': {
          'title': 'Reverse Proxy'
        },
        'dyndns': {
          'title': 'Dynamic DNS'
        },
        'alt-webui': {
          'title': 'Alternative WebUI'
        }
      }
    },
    'advanced': {
      'title': 'Advanced',
      'description': 'qBittorrent internals and libtorrent performance tuning.',
      'groups': {
        'qbt': {
          'title': 'qBittorrent Section'
        },
        'libtorrent': {
          'title': 'libtorrent Section'
        }
      }
    }
  },
  'fields': {
    'torrent_content_layout': {
      'label': 'Torrent content layout',
      'options': {
        'Original': 'Original',
        'Subfolder': 'Create subfolder',
        'NoSubfolder': 'Don\'t create subfolder'
      }
    },
    'add_to_top_of_queue': {
      'label': 'Add to top of queue'
    },
    'start_paused_enabled': {
      'label': 'Do not start the download automatically'
    },
    'torrent_stop_condition': {
      'label': 'Torrent stop condition',
      'options': {
        'None': 'None',
        'MetadataReceived': 'Metadata received',
        'FilesChecked': 'Files checked'
      }
    },
    'merge_trackers': {
      'label': 'Merge trackers to existing torrent'
    },
    'delete_torrent_files_afterwards': {
      'label': 'Delete server-local .torrent files afterwards',
      'description': 'Deletes .torrent files opened directly by qBittorrent after adding. This does not delete files selected in Taurent.'
    },
    'preallocate_all': {
      'label': 'Pre-allocate disk space for all files'
    },
    'incomplete_files_ext': {
      'label': 'Append .!qB extension to incomplete files'
    },
    'auto_tmm_enabled': {
      'label': 'Default torrent management mode',
      'options': {
        '0': 'Manual',
        '1': 'Automatic'
      }
    },
    'torrent_changed_tmm_enabled': {
      'label': 'When torrent category changed',
      'options': {
        '0': 'Do nothing',
        '1': 'Relocate torrent'
      }
    },
    'save_path_changed_tmm_enabled': {
      'label': 'When default save path changed',
      'options': {
        '0': 'Do nothing',
        '1': 'Relocate affected torrents'
      }
    },
    'category_changed_tmm_enabled': {
      'label': 'When category save path changed',
      'options': {
        '0': 'Do nothing',
        '1': 'Relocate affected torrents'
      }
    },
    'use_subcategories': {
      'label': 'Use subcategories'
    },
    'use_category_paths_in_manual_mode': {
      'label': 'Use category paths in manual mode'
    },
    'save_path': {
      'label': 'Default save path'
    },
    'temp_path_enabled': {
      'label': 'Keep incomplete torrents in'
    },
    'temp_path': {
      'label': 'Incomplete torrents path'
    },
    'export_dir': {
      'label': 'Copy .torrent files to',
      'description': 'Leave empty to disable'
    },
    'export_dir_fin': {
      'label': 'Copy .torrent files for finished downloads to',
      'description': 'Leave empty to disable'
    },
    'excluded_file_names_enabled': {
      'label': 'Enable excluded file names'
    },
    'excluded_file_names': {
      'label': 'File name patterns',
      'description': 'One pattern per line (supports wildcards)'
    },
    'mail_notification_enabled': {
      'label': 'Email notification upon download completion'
    },
    'mail_notification_sender': {
      'label': 'From'
    },
    'mail_notification_email': {
      'label': 'To'
    },
    'mail_notification_smtp': {
      'label': 'SMTP server'
    },
    'mail_notification_ssl_enabled': {
      'label': 'This server requires a secure connection (SSL)'
    },
    'mail_notification_auth_enabled': {
      'label': 'Authentication'
    },
    'mail_notification_username': {
      'label': 'Username'
    },
    'mail_notification_password': {
      'label': 'Password'
    },
    'autorun_on_torrent_added_enabled': {
      'label': 'Run on torrent added'
    },
    'autorun_on_torrent_added_program': {
      'label': 'Command'
    },
    'autorun_enabled': {
      'label': 'Run on torrent finished'
    },
    'autorun_program': {
      'label': 'Command'
    },
    'bittorrent_protocol': {
      'label': 'Peer connection protocol',
      'options': {
        '0': 'TCP and µTP',
        '1': 'TCP',
        '2': 'µTP'
      }
    },
    'listen_port': {
      'label': 'Port used for incoming connections',
      'editorTitle': 'Listening port',
      'unit': '1–65535'
    },
    'upnp': {
      'label': 'Use UPnP / NAT-PMP port forwarding from my router'
    },
    'max_connec': {
      'label': 'Global maximum number of connections',
      'editorTitle': 'Max connections'
    },
    'max_connec_per_torrent': {
      'label': 'Maximum number of connections per torrent',
      'editorTitle': 'Max per torrent'
    },
    'max_uploads': {
      'label': 'Global maximum number of upload slots',
      'editorTitle': 'Max upload slots'
    },
    'max_uploads_per_torrent': {
      'label': 'Maximum number of upload slots per torrent',
      'editorTitle': 'Max per torrent'
    },
    'i2p_enabled': {
      'label': 'I2P (Experimental)'
    },
    'i2p_address': {
      'label': 'Host'
    },
    'i2p_port': {
      'label': 'Port',
      'editorTitle': 'Port'
    },
    'i2p_mixed_mode': {
      'label': 'Mixed mode'
    },
    'proxy_type': {
      'label': 'Type',
      'options': {
        '0': '(None)',
        '1': 'HTTP',
        '2': 'SOCKS5',
        '3': 'HTTP with auth',
        '4': 'SOCKS5 with auth',
        '5': 'SOCKS4'
      }
    },
    'proxy_ip': {
      'label': 'Host'
    },
    'proxy_port': {
      'label': 'Port',
      'editorTitle': 'Port'
    },
    'proxy_peer_connections': {
      'label': 'Perform hostname lookup via proxy'
    },
    'proxy_auth_enabled': {
      'label': 'Authentication'
    },
    'proxy_username': {
      'label': 'Username'
    },
    'proxy_password': {
      'label': 'Password'
    },
    'proxy_torrents_only': {
      'label': 'Use proxy for BitTorrent purposes'
    },
    'ip_filter_enabled': {
      'label': 'Enable IP filtering'
    },
    'ip_filter_path': {
      'label': 'Filter path (.dat, .p2p, .p2b)'
    },
    'ip_filter_trackers': {
      'label': 'Apply to trackers'
    },
    'up_limit': {
      'label': 'Upload',
      'description': '0 means unlimited',
      'editorTitle': 'Upload',
      'unit': '0 = unlimited'
    },
    'dl_limit': {
      'label': 'Download',
      'description': '0 means unlimited',
      'editorTitle': 'Download',
      'unit': '0 = unlimited'
    },
    'alt_up_limit': {
      'label': 'Upload',
      'description': '0 means unlimited',
      'editorTitle': 'Alt upload',
      'unit': '0 = unlimited'
    },
    'alt_dl_limit': {
      'label': 'Download',
      'description': '0 means unlimited',
      'editorTitle': 'Alt download',
      'unit': '0 = unlimited'
    },
    'scheduler_enabled': {
      'label': 'Schedule the use of alternative rate limits'
    },
    'schedule_from_hour': {
      'label': 'From hour',
      'editorTitle': 'From hour'
    },
    'schedule_from_min': {
      'label': 'From minute',
      'editorTitle': 'From min'
    },
    'schedule_to_hour': {
      'label': 'To hour',
      'editorTitle': 'To hour'
    },
    'schedule_to_min': {
      'label': 'To minute',
      'editorTitle': 'To min'
    },
    'scheduler_days': {
      'label': 'When',
      'options': {
        '0': 'Every day',
        '1': 'Weekdays',
        '2': 'Weekends',
        '3': 'Monday',
        '4': 'Tuesday',
        '5': 'Wednesday',
        '6': 'Thursday',
        '7': 'Friday',
        '8': 'Saturday',
        '9': 'Sunday'
      }
    },
    'limit_utp_rate': {
      'label': 'Apply rate limit to µTP protocol'
    },
    'limit_tcp_overhead': {
      'label': 'Apply rate limit to transport overhead'
    },
    'limit_lan_peers': {
      'label': 'Apply rate limit to peers on LAN'
    },
    'dht': {
      'label': 'Enable DHT (decentralized network) to find more peers'
    },
    'pex': {
      'label': 'Enable Peer Exchange (PeX) to find more peers'
    },
    'lsd': {
      'label': 'Enable Local Peer Discovery to find more peers'
    },
    'encryption': {
      'label': 'Encryption mode',
      'options': {
        '0': 'Allow encryption',
        '1': 'Force encryption',
        '2': 'Disable encryption'
      }
    },
    'anonymous_mode': {
      'label': 'Enable anonymous mode'
    },
    'max_active_checking_torrents': {
      'label': 'Max active checking torrents',
      'editorTitle': 'Max checking'
    },
    'queueing_enabled': {
      'label': 'Torrent queueing'
    },
    'max_active_downloads': {
      'label': 'Maximum active downloads',
      'editorTitle': 'Max downloads'
    },
    'max_active_uploads': {
      'label': 'Maximum active uploads',
      'editorTitle': 'Max uploads'
    },
    'max_active_torrents': {
      'label': 'Maximum active torrents',
      'editorTitle': 'Max torrents'
    },
    'dont_count_slow_torrents': {
      'label': 'Do not count slow torrents in these limits'
    },
    'slow_torrent_dl_rate_threshold': {
      'label': 'Download rate threshold',
      'editorTitle': 'Download rate threshold',
      'unit': '0 = unlimited'
    },
    'slow_torrent_ul_rate_threshold': {
      'label': 'Upload rate threshold',
      'editorTitle': 'Upload rate threshold',
      'unit': '0 = unlimited'
    },
    'slow_torrent_inactive_timer': {
      'label': 'Torrent inactivity timer (seconds)',
      'editorTitle': 'Seconds'
    },
    'max_ratio_enabled': {
      'label': 'When ratio reaches'
    },
    'max_ratio': {
      'label': 'Ratio limit',
      'editorTitle': 'Ratio'
    },
    'max_seeding_time_enabled': {
      'label': 'When total seeding time reaches'
    },
    'max_seeding_time': {
      'label': 'Seeding time (minutes)',
      'editorTitle': 'Minutes'
    },
    'max_inactive_seeding_time_enabled': {
      'label': 'When inactive seeding time reaches'
    },
    'max_inactive_seeding_time': {
      'label': 'Inactive time (minutes)',
      'editorTitle': 'Minutes'
    },
    'max_ratio_act': {
      'label': 'Then',
      'options': {
        '0': 'Pause torrent',
        '1': 'Remove torrent',
        '6': 'Stop torrent'
      }
    },
    'add_trackers_enabled': {
      'label': 'Automatically append these trackers to new downloads'
    },
    'add_trackers': {
      'label': 'Trackers (one URL per line)'
    },
    'web_ui_address': {
      'label': 'IP address'
    },
    'web_ui_port': {
      'label': 'Port',
      'editorTitle': 'Port'
    },
    'web_ui_upnp': {
      'label': 'Use UPnP / NAT-PMP to forward the port from my router'
    },
    'use_https': {
      'label': 'Use HTTPS instead of HTTP'
    },
    'web_ui_https_cert': {
      'label': 'Certificate'
    },
    'web_ui_https_key': {
      'label': 'Key'
    },
    'web_ui_username': {
      'label': 'Username'
    },
    'bypass_local_auth': {
      'label': 'Bypass authentication for clients on localhost'
    },
    'bypass_auth_subnet_whitelist_enabled': {
      'label': 'Bypass authentication for clients in whitelisted IP subnets'
    },
    'bypass_auth_subnet_whitelist': {
      'label': 'Whitelisted subnets',
      'description': 'Example: 172.17.32.0/24, fdff:ffff:c8::/40'
    },
    'web_ui_max_auth_fail_count': {
      'label': 'Ban client after consecutive failures',
      'editorTitle': 'Failures'
    },
    'web_ui_ban_duration': {
      'label': 'Ban for (seconds)',
      'editorTitle': 'Seconds'
    },
    'web_ui_session_timeout': {
      'label': 'Session timeout (seconds)',
      'editorTitle': 'Seconds'
    },
    'web_ui_clickjacking_protection_enabled': {
      'label': 'Enable clickjacking protection'
    },
    'web_ui_csrf_protection_enabled': {
      'label': 'Enable Cross-Site Request Forgery (CSRF) protection'
    },
    'web_ui_secure_cookie_enabled': {
      'label': 'Enable cookie Secure flag (requires HTTPS or localhost)'
    },
    'web_ui_host_header_validation_enabled': {
      'label': 'Enable Host header validation'
    },
    'web_ui_domain_list': {
      'label': 'Server domains'
    },
    'web_ui_use_custom_http_headers_enabled': {
      'label': 'Add custom HTTP headers'
    },
    'web_ui_custom_http_headers': {
      'label': 'Headers',
      'description': 'Header: value pairs, one per line'
    },
    'web_ui_reverse_proxy_enabled': {
      'label': 'Enable reverse proxy support'
    },
    'web_ui_reverse_proxies_list': {
      'label': 'Trusted proxies list'
    },
    'dyndns_enabled': {
      'label': 'Update my dynamic domain name'
    },
    'dyndns_service': {
      'label': 'Service',
      'options': {
        '0': 'DynDNS',
        '1': 'NO-IP'
      }
    },
    'dyndns_domain': {
      'label': 'Domain name'
    },
    'dyndns_username': {
      'label': 'Username'
    },
    'dyndns_password': {
      'label': 'Password'
    },
    'alternative_webui_enabled': {
      'label': 'Use alternative WebUI'
    },
    'alternative_webui_path': {
      'label': 'Files location'
    },
    'resume_data_storage_type': {
      'label': 'Resume data storage type (requires restart)',
      'options': {
        'Legacy': 'Fastresume files',
        'SQLite': 'SQLite database'
      }
    },
    'torrent_content_removing_mode': {
      'label': 'Torrent content removing mode',
      'options': {
        'MoveToTrash': 'Move to trash',
        'Delete': 'Delete files permanently'
      }
    },
    'memory_working_set_limit': {
      'label': 'Physical memory (RAM) usage limit (MiB)',
      'editorTitle': 'MiB'
    },
    'current_network_interface': {
      'label': 'Network interface'
    },
    'current_ip_address': {
      'label': 'Optional IP address to bind to'
    },
    'save_resume_data_interval': {
      'label': 'Save resume data interval (min)',
      'editorTitle': 'Minutes'
    },
    'save_statistics_interval': {
      'label': 'Save statistics interval (min)',
      'editorTitle': 'Minutes'
    },
    'torrent_file_size_limit': {
      'label': '.torrent file size limit (MiB)',
      'editorTitle': 'MiB'
    },
    'confirm_torrent_recheck': {
      'label': 'Confirm torrent recheck'
    },
    'recheck_completed_torrents': {
      'label': 'Recheck torrents on completion'
    },
    'customize_application_instance_name': {
      'label': 'Customize application instance name'
    },
    'refresh_interval': {
      'label': 'Refresh interval (ms)',
      'editorTitle': 'ms'
    },
    'resolve_peer_countries': {
      'label': 'Resolve peer countries'
    },
    'reannounce_when_address_changed': {
      'label': 'Reannounce to all trackers when IP or port changed'
    },
    'enable_embedded_tracker': {
      'label': 'Enable embedded tracker'
    },
    'embedded_tracker_port': {
      'label': 'Embedded tracker port',
      'editorTitle': 'Port'
    },
    'enable_port_forwarding_for_embedded_tracker': {
      'label': 'Enable port forwarding for embedded tracker'
    },
    'ignore_ssl_errors': {
      'label': 'Ignore SSL errors'
    },
    'python_executable_path': {
      'label': 'Python executable path (may require restart)',
      'description': 'Auto detect if empty'
    },
    'bdecode_depth_limit': {
      'label': 'Bdecode depth limit',
      'editorTitle': 'Limit'
    },
    'bdecode_token_limit': {
      'label': 'Bdecode token limit',
      'editorTitle': 'Limit'
    },
    'async_io_threads': {
      'label': 'Asynchronous I/O threads',
      'editorTitle': 'Threads'
    },
    'hashing_threads': {
      'label': 'Hashing threads',
      'editorTitle': 'Threads'
    },
    'file_pool_size': {
      'label': 'File pool size',
      'editorTitle': 'Size'
    },
    'checking_memory_use': {
      'label': 'Outstanding memory when checking torrents (MiB)',
      'editorTitle': 'MiB'
    },
    'disk_queue_size': {
      'label': 'Disk queue size (KiB)',
      'editorTitle': 'KiB'
    },
    'disk_io_type': {
      'label': 'Disk IO type (requires restart)',
      'options': {
        '0': 'Default',
        '1': 'Memory mapped files',
        '2': 'POSIX-compliant'
      }
    },
    'disk_io_read_mode': {
      'label': 'Disk IO read mode',
      'options': {
        '0': 'Enable OS cache',
        '1': 'Disable OS cache'
      }
    },
    'disk_io_write_mode': {
      'label': 'Disk IO write mode',
      'options': {
        '0': 'Enable OS cache',
        '1': 'Disable OS cache'
      }
    },
    'enable_piece_extent_affinity': {
      'label': 'Use piece extent affinity'
    },
    'enable_upload_suggestions': {
      'label': 'Send upload piece suggestions'
    },
    'send_buffer_watermark': {
      'label': 'Send buffer watermark (KiB)',
      'editorTitle': 'KiB'
    },
    'send_buffer_low_watermark': {
      'label': 'Send buffer low watermark (KiB)',
      'editorTitle': 'KiB'
    },
    'send_buffer_watermark_factor': {
      'label': 'Send buffer watermark factor (%)',
      'editorTitle': '%'
    },
    'connection_speed': {
      'label': 'Outgoing connections per second',
      'editorTitle': 'Connections/s'
    },
    'socket_send_buffer_size': {
      'label': 'Socket send buffer size [0: system default] (KiB)',
      'editorTitle': 'KiB'
    },
    'socket_receive_buffer_size': {
      'label': 'Socket receive buffer size [0: system default] (KiB)',
      'editorTitle': 'KiB'
    },
    'socket_backlog_size': {
      'label': 'Socket backlog size',
      'editorTitle': 'Size'
    },
    'outgoing_ports_min': {
      'label': 'Outgoing ports (Min) [0: disabled]',
      'editorTitle': 'Port'
    },
    'outgoing_ports_max': {
      'label': 'Outgoing ports (Max) [0: disabled]',
      'editorTitle': 'Port'
    },
    'upnp_lease_duration': {
      'label': 'UPnP lease duration [0: permanent]',
      'editorTitle': 'Seconds'
    },
    'peer_tos': {
      'label': 'Type of service (ToS) for connections to peers',
      'editorTitle': 'Value'
    },
    'utp_tcp_mixed_mode': {
      'label': 'µTP-TCP mixed mode algorithm',
      'options': {
        '0': 'Prefer TCP',
        '1': 'Peer proportional'
      }
    },
    'idn_support_enabled': {
      'label': 'Support internationalized domain name (IDN)'
    },
    'enable_multi_connections_from_same_ip': {
      'label': 'Allow multiple connections from the same IP address'
    },
    'validate_https_tracker_certificate': {
      'label': 'Validate HTTPS tracker certificate'
    },
    'ssrf_mitigation': {
      'label': 'Server-side request forgery (SSRF) mitigation'
    },
    'block_peers_on_privileged_ports': {
      'label': 'Disallow connection to peers on privileged ports'
    },
    'upload_slots_behavior': {
      'label': 'Upload slots behavior',
      'options': {
        '0': 'Fixed slots',
        '1': 'Upload rate based'
      }
    },
    'upload_choking_algorithm': {
      'label': 'Upload choking algorithm',
      'options': {
        '0': 'Round-robin',
        '1': 'Fastest upload',
        '2': 'Anti-leech'
      }
    },
    'announce_to_all_trackers': {
      'label': 'Always announce to all trackers in a tier'
    },
    'announce_to_all_tiers': {
      'label': 'Always announce to all tiers'
    },
    'announce_ip': {
      'label': 'IP address reported to trackers (requires restart)'
    },
    'announce_port': {
      'label': 'Port reported to trackers [0: listening port]',
      'editorTitle': 'Port'
    },
    'max_concurrent_http_announces': {
      'label': 'Max concurrent HTTP announces',
      'editorTitle': 'Announcements'
    },
    'stop_tracker_timeout': {
      'label': 'Stop tracker timeout [0: disabled]',
      'editorTitle': 'Seconds'
    },
    'peer_turnover': {
      'label': 'Peer turnover disconnect percentage (%)',
      'editorTitle': '%'
    },
    'peer_turnover_cutoff': {
      'label': 'Peer turnover threshold percentage (%)',
      'editorTitle': '%'
    },
    'peer_turnover_interval': {
      'label': 'Peer turnover disconnect interval (s)',
      'editorTitle': 'Seconds'
    },
    'request_queue_size': {
      'label': 'Maximum outstanding requests to a single peer',
      'editorTitle': 'Size'
    },
    'dht_bootstrap_nodes': {
      'label': 'DHT bootstrap nodes'
    },
    'i2p_inbound_quantity': {
      'label': 'I2P inbound quantity',
      'editorTitle': 'Qty'
    },
    'i2p_outbound_quantity': {
      'label': 'I2P outbound quantity',
      'editorTitle': 'Qty'
    },
    'i2p_inbound_length': {
      'label': 'I2P inbound length',
      'editorTitle': 'Length'
    },
    'i2p_outbound_length': {
      'label': 'I2P outbound length',
      'editorTitle': 'Length'
    }
  }
} as const;
